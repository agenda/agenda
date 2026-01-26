import debug from 'debug';
import { Pool, PoolClient } from 'pg';
import {
	toJobId,
	computeJobState
} from 'agenda';
import type {
	IJobRepository,
	IJobRepositoryOptions,
	IRemoveJobsOptions,
	IJobParameters,
	JobId,
	IJobsQueryOptions,
	IJobsResult,
	IJobsOverview,
	IJobWithState,
	IJobsSort
} from 'agenda';
import type { IPostgresBackendConfig, IPostgresJobRow } from './types.js';
import {
	getCreateTableSQL,
	getCreateIndexesSQL,
	getUpdateTimestampTriggerSQL
} from './schema.js';

const log = debug('agenda:postgres:repository');

/**
 * PostgreSQL implementation of IJobRepository
 */
export class PostgresJobRepository implements IJobRepository {
	private pool!: Pool;
	private ownPool: boolean;
	private tableName: string;
	private ensureSchema: boolean;
	private sort: { nextRunAt?: 1 | -1; priority?: 1 | -1 };
	private disconnected: boolean = false;

	constructor(private config: IPostgresBackendConfig) {
		this.tableName = config.tableName || 'agenda_jobs';
		this.ensureSchema = config.ensureSchema ?? true;
		this.sort = config.sort || { nextRunAt: 1, priority: -1 };

		// Use existing pool or create a new one
		if (config.pool) {
			// Use existing pool (won't be closed on disconnect)
			this.pool = config.pool;
			this.ownPool = false;
		} else if (config.connectionString || config.poolConfig) {
			this.ownPool = true;
			this.createPool();
		} else {
			throw new Error('PostgresBackend requires pool, connectionString, or poolConfig');
		}
	}

	private createPool(): void {
		if (this.config.connectionString) {
			this.pool = new Pool({ connectionString: this.config.connectionString });
		} else if (this.config.poolConfig) {
			this.pool = new Pool(this.config.poolConfig);
		}
		this.disconnected = false;
	}

	/**
	 * Get the underlying pool (for use by notification channel)
	 */
	getPool(): Pool {
		return this.pool;
	}

	async connect(): Promise<void> {
		log('connecting to PostgreSQL');

		// Recreate pool if it was disconnected
		if (this.disconnected && this.ownPool) {
			log('recreating pool after disconnect');
			this.createPool();
		}

		// Test connection
		const client = await this.pool.connect();
		try {
			await client.query('SELECT 1');
			log('connection successful');

			if (this.ensureSchema) {
				await this.createSchema(client);
			}
		} finally {
			client.release();
		}
	}

	private async createSchema(client: PoolClient): Promise<void> {
		log('ensuring schema exists');

		// Create table
		await client.query(getCreateTableSQL(this.tableName));
		log('table created or already exists');

		// Create indexes
		for (const sql of getCreateIndexesSQL(this.tableName)) {
			await client.query(sql);
		}
		log('indexes created or already exist');

		// Create update trigger
		await client.query(getUpdateTimestampTriggerSQL(this.tableName));
		log('update trigger created');
	}

	async disconnect(): Promise<void> {
		log('disconnecting from PostgreSQL');
		// Note: We don't close the pool here - it's reused across multiple agenda instances
		// The pool will be closed when the application shuts down
		// This matches the behavior of MongoBackend.disconnect() which is also a no-op
	}

	/**
	 * Force close the pool - should only be called on application shutdown
	 * or when you're sure the backend won't be reused
	 */
	async close(): Promise<void> {
		log('closing PostgreSQL pool');
		if (this.ownPool && !this.disconnected) {
			await this.pool.end();
			this.disconnected = true;
		}
	}

	/**
	 * Convert PostgreSQL row to IJobParameters
	 */
	private rowToJob<DATA = unknown>(row: IPostgresJobRow): IJobParameters<DATA> {
		return {
			_id: toJobId(row.id) as JobId,
			name: row.name,
			priority: row.priority,
			nextRunAt: row.next_run_at,
			type: row.type,
			lockedAt: row.locked_at ?? undefined,
			lastFinishedAt: row.last_finished_at ?? undefined,
			failedAt: row.failed_at ?? undefined,
			failCount: row.fail_count ?? undefined,
			failReason: row.fail_reason ?? undefined,
			repeatTimezone: row.repeat_timezone ?? undefined,
			lastRunAt: row.last_run_at ?? undefined,
			repeatInterval: row.repeat_interval ?? undefined,
			data: row.data as DATA,
			repeatAt: row.repeat_at ?? undefined,
			disabled: row.disabled,
			progress: row.progress ?? undefined,
			fork: row.fork ?? undefined,
			lastModifiedBy: row.last_modified_by ?? undefined
		};
	}

	/**
	 * Convert sort options to PostgreSQL ORDER BY clause
	 */
	private toOrderByClause(sort?: IJobsSort): string {
		if (!sort) {
			return 'next_run_at DESC NULLS LAST, last_run_at DESC NULLS LAST';
		}

		const parts: string[] = [];

		if (sort.nextRunAt !== undefined) {
			parts.push(`next_run_at ${sort.nextRunAt === 1 ? 'ASC' : 'DESC'} NULLS LAST`);
		}
		if (sort.lastRunAt !== undefined) {
			parts.push(`last_run_at ${sort.lastRunAt === 1 ? 'ASC' : 'DESC'} NULLS LAST`);
		}
		if (sort.lastFinishedAt !== undefined) {
			parts.push(`last_finished_at ${sort.lastFinishedAt === 1 ? 'ASC' : 'DESC'} NULLS LAST`);
		}
		if (sort.priority !== undefined) {
			parts.push(`priority ${sort.priority === 1 ? 'ASC' : 'DESC'}`);
		}
		if (sort.name !== undefined) {
			parts.push(`name ${sort.name === 1 ? 'ASC' : 'DESC'}`);
		}

		return parts.length > 0
			? parts.join(', ')
			: 'next_run_at DESC NULLS LAST, last_run_at DESC NULLS LAST';
	}

	async getJobById(id: string): Promise<IJobParameters | null> {
		const result = await this.pool.query<IPostgresJobRow>(
			`SELECT * FROM "${this.tableName}" WHERE id = $1`,
			[id]
		);

		if (result.rows.length === 0) {
			return null;
		}

		return this.rowToJob(result.rows[0]);
	}

	async queryJobs(options: IJobsQueryOptions = {}): Promise<IJobsResult> {
		const {
			name,
			names,
			state,
			id,
			ids,
			search,
			data,
			includeDisabled = true,
			sort,
			skip = 0,
			limit = 0
		} = options;
		const now = new Date();

		// Build query
		const conditions: string[] = [];
		const params: unknown[] = [];
		let paramIndex = 1;

		if (name) {
			conditions.push(`name = $${paramIndex++}`);
			params.push(name);
		} else if (names && names.length > 0) {
			conditions.push(`name = ANY($${paramIndex++})`);
			params.push(names);
		}

		if (id) {
			conditions.push(`id = $${paramIndex++}`);
			params.push(id);
		} else if (ids && ids.length > 0) {
			conditions.push(`id = ANY($${paramIndex++}::uuid[])`);
			params.push(ids);
		}

		if (search) {
			conditions.push(`name ILIKE $${paramIndex++}`);
			params.push(`%${search}%`);
		}

		if (data !== undefined) {
			conditions.push(`data @> $${paramIndex++}::jsonb`);
			params.push(JSON.stringify(data));
		}

		if (!includeDisabled) {
			conditions.push('disabled = FALSE');
		}

		const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
		const orderByClause = this.toOrderByClause(sort);

		const query = `
			SELECT * FROM "${this.tableName}"
			${whereClause}
			ORDER BY ${orderByClause}
		`;

		const result = await this.pool.query<IPostgresJobRow>(query, params);

		// Compute states and filter by state if specified
		let jobsWithState: IJobWithState[] = result.rows
			.map(row => {
				const job = this.rowToJob(row);
				return {
					...job,
					_id: job._id as JobId,
					state: computeJobState(job, now)
				};
			})
			.filter(job => !state || job.state === state);

		// Apply pagination after state filtering
		const total = jobsWithState.length;
		if (limit > 0) {
			jobsWithState = jobsWithState.slice(skip, skip + limit);
		} else if (skip > 0) {
			jobsWithState = jobsWithState.slice(skip);
		}

		return { jobs: jobsWithState, total };
	}

	async getJobsOverview(): Promise<IJobsOverview[]> {
		const now = new Date();
		const names = await this.getDistinctJobNames();

		const overviews = await Promise.all(
			names.map(async name => {
				const result = await this.pool.query<IPostgresJobRow>(
					`SELECT * FROM "${this.tableName}" WHERE name = $1`,
					[name]
				);

				const overview: IJobsOverview = {
					name,
					total: result.rows.length,
					running: 0,
					scheduled: 0,
					queued: 0,
					completed: 0,
					failed: 0,
					repeating: 0
				};

				for (const row of result.rows) {
					const job = this.rowToJob(row);
					const state = computeJobState(job, now);
					overview[state as keyof typeof overview]++;
				}

				return overview;
			})
		);

		return overviews;
	}

	async getDistinctJobNames(): Promise<string[]> {
		const result = await this.pool.query<{ name: string }>(
			`SELECT DISTINCT name FROM "${this.tableName}" ORDER BY name`
		);
		return result.rows.map(row => row.name);
	}

	async getQueueSize(): Promise<number> {
		const result = await this.pool.query<{ count: string }>(
			`SELECT COUNT(*) as count FROM "${this.tableName}" WHERE next_run_at < NOW()`,
		);
		return parseInt(result.rows[0].count, 10);
	}

	async removeJobs(options: IRemoveJobsOptions): Promise<number> {
		const conditions: string[] = [];
		const params: unknown[] = [];
		let paramIndex = 1;

		if (options.id) {
			conditions.push(`id = $${paramIndex++}`);
			params.push(options.id.toString());
		} else if (options.ids && options.ids.length > 0) {
			conditions.push(`id = ANY($${paramIndex++}::uuid[])`);
			params.push(options.ids.map(id => id.toString()));
		}

		if (options.name) {
			conditions.push(`name = $${paramIndex++}`);
			params.push(options.name);
		} else if (options.names && options.names.length > 0) {
			conditions.push(`name = ANY($${paramIndex++})`);
			params.push(options.names);
		} else if (options.notNames && options.notNames.length > 0) {
			conditions.push(`name != ALL($${paramIndex++})`);
			params.push(options.notNames);
		}

		if (options.data !== undefined) {
			conditions.push(`data @> $${paramIndex++}::jsonb`);
			params.push(JSON.stringify(options.data));
		}

		// If no criteria provided, don't delete anything
		if (conditions.length === 0) {
			return 0;
		}

		const result = await this.pool.query(
			`DELETE FROM "${this.tableName}" WHERE ${conditions.join(' AND ')}`,
			params
		);

		return result.rowCount || 0;
	}

	async unlockJob(job: IJobParameters): Promise<void> {
		if (!job._id) return;

		// Only unlock jobs which are not currently processed (nextRunAt is not null)
		await this.pool.query(
			`UPDATE "${this.tableName}"
			 SET locked_at = NULL
			 WHERE id = $1 AND next_run_at IS NOT NULL`,
			[job._id.toString()]
		);
	}

	async unlockJobs(jobIds: (JobId | string)[]): Promise<void> {
		if (jobIds.length === 0) return;

		const ids = jobIds.map(id => id.toString());
		await this.pool.query(
			`UPDATE "${this.tableName}"
			 SET locked_at = NULL
			 WHERE id = ANY($1::uuid[])`,
			[ids]
		);
	}

	async lockJob(
		job: IJobParameters,
		options: IJobRepositoryOptions | undefined
	): Promise<IJobParameters | undefined> {
		if (!job._id) return undefined;

		const orderBy = `${this.sort.nextRunAt === 1 ? 'next_run_at ASC' : 'next_run_at DESC'} NULLS LAST, ${this.sort.priority === -1 ? 'priority DESC' : 'priority ASC'}`;

		// Atomic lock using UPDATE ... RETURNING
		const result = await this.pool.query<IPostgresJobRow>(
			`UPDATE "${this.tableName}"
			 SET locked_at = NOW(), last_modified_by = $4
			 WHERE id = (
				 SELECT id FROM "${this.tableName}"
				 WHERE id = $1
				   AND name = $2
				   AND locked_at IS NULL
				   AND next_run_at = $3
				   AND disabled = FALSE
				 ORDER BY ${orderBy}
				 LIMIT 1
				 FOR UPDATE SKIP LOCKED
			 )
			 RETURNING *`,
			[job._id.toString(), job.name, job.nextRunAt, options?.lastModifiedBy || null]
		);

		if (result.rows.length === 0) {
			return undefined;
		}

		return this.rowToJob(result.rows[0]);
	}

	async getNextJobToRun(
		jobName: string,
		nextScanAt: Date,
		lockDeadline: Date,
		now: Date | undefined,
		options: IJobRepositoryOptions | undefined
	): Promise<IJobParameters | undefined> {
		const lockTime = now ?? new Date();
		const orderBy = `${this.sort.nextRunAt === 1 ? 'next_run_at ASC' : 'next_run_at DESC'} NULLS LAST, ${this.sort.priority === -1 ? 'priority DESC' : 'priority ASC'}`;

		// Find and lock job atomically using UPDATE ... RETURNING with subquery
		const result = await this.pool.query<IPostgresJobRow>(
			`UPDATE "${this.tableName}"
			 SET locked_at = $1, last_modified_by = $5
			 WHERE id = (
				 SELECT id FROM "${this.tableName}"
				 WHERE name = $2
				   AND disabled = FALSE
				   AND (
					   (locked_at IS NULL AND next_run_at <= $3)
					   OR locked_at <= $4
				   )
				 ORDER BY ${orderBy}
				 LIMIT 1
				 FOR UPDATE SKIP LOCKED
			 )
			 RETURNING *`,
			[lockTime, jobName, nextScanAt, lockDeadline, options?.lastModifiedBy || null]
		);

		if (result.rows.length === 0) {
			return undefined;
		}

		return this.rowToJob(result.rows[0]);
	}

	async saveJobState(
		job: IJobParameters,
		options: IJobRepositoryOptions | undefined
	): Promise<void> {
		if (!job._id) {
			throw new Error('Cannot save job state without job ID');
		}

		const result = await this.pool.query(
			`UPDATE "${this.tableName}"
			 SET locked_at = $2,
				 next_run_at = $3,
				 last_run_at = $4,
				 progress = $5,
				 fail_reason = $6,
				 fail_count = $7,
				 failed_at = $8,
				 last_finished_at = $9,
				 last_modified_by = $11
			 WHERE id = $1 AND name = $10`,
			[
				job._id.toString(),
				job.lockedAt || null,
				job.nextRunAt || null,
				job.lastRunAt || null,
				job.progress ?? null,
				job.failReason ?? null,
				job.failCount ?? null,
				job.failedAt || null,
				job.lastFinishedAt || null,
				job.name,
				options?.lastModifiedBy || null
			]
		);

		if (result.rowCount !== 1) {
			throw new Error(
				`job ${job._id} (name: ${job.name}) cannot be updated in the database, maybe it does not exist anymore?`
			);
		}
	}

	async saveJob<DATA = unknown>(
		job: IJobParameters<DATA>,
		options: IJobRepositoryOptions | undefined
	): Promise<IJobParameters<DATA>> {
		log('attempting to save a job');

		const { _id, unique, uniqueOpts, ...props } = job;

		// If the job already has an ID, update it
		if (_id) {
			log('job already has _id, updating');
			const result = await this.pool.query<IPostgresJobRow>(
				`UPDATE "${this.tableName}"
				 SET name = $2,
					 priority = $3,
					 next_run_at = $4,
					 type = $5,
					 repeat_timezone = $6,
					 repeat_interval = $7,
					 data = $8,
					 repeat_at = $9,
					 disabled = $10,
					 fork = $11,
					 fail_reason = $12,
					 fail_count = $13,
					 failed_at = $14,
					 last_modified_by = $15
				 WHERE id = $1 AND name = $2
				 RETURNING *`,
				[
					_id.toString(),
					props.name,
					props.priority,
					props.nextRunAt || null,
					props.type,
					props.repeatTimezone || null,
					props.repeatInterval || null,
					JSON.stringify(props.data),
					props.repeatAt || null,
					props.disabled || false,
					props.fork || false,
					props.failReason ?? null,
					props.failCount ?? null,
					props.failedAt || null,
					options?.lastModifiedBy || null
				]
			);

			if (result.rows.length === 0) {
				// Job was removed, return original data unchanged
				log('job %s was not found for update, returning original data', _id);
				return job;
			}

			return this.rowToJob<DATA>(result.rows[0]);
		}

		// Handle 'single' type jobs - upsert by name
		if (props.type === 'single') {
			log('job with type of "single" found');

			const now = new Date();
			const shouldProtectNextRunAt = props.nextRunAt && props.nextRunAt <= now;

			// Use ON CONFLICT to upsert
			const result = await this.pool.query<IPostgresJobRow>(
				`INSERT INTO "${this.tableName}" (
					name, priority, next_run_at, type, repeat_timezone,
					repeat_interval, data, repeat_at, disabled, fork, last_modified_by
				 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
				 ON CONFLICT ((name)) WHERE type = 'single'
				 DO UPDATE SET
					priority = EXCLUDED.priority,
					next_run_at = ${shouldProtectNextRunAt
						? `COALESCE("${this.tableName}".next_run_at, EXCLUDED.next_run_at)`
						: 'EXCLUDED.next_run_at'},
					repeat_timezone = EXCLUDED.repeat_timezone,
					repeat_interval = EXCLUDED.repeat_interval,
					data = EXCLUDED.data,
					repeat_at = EXCLUDED.repeat_at,
					disabled = EXCLUDED.disabled,
					fork = EXCLUDED.fork,
					last_modified_by = EXCLUDED.last_modified_by
				 RETURNING *`,
				[
					props.name,
					props.priority,
					props.nextRunAt || null,
					props.type,
					props.repeatTimezone || null,
					props.repeatInterval || null,
					JSON.stringify(props.data),
					props.repeatAt || null,
					props.disabled || false,
					props.fork || false,
					options?.lastModifiedBy || null
				]
			);

			return this.rowToJob<DATA>(result.rows[0]);
		}

		// Handle unique constraint
		if (unique) {
			log('calling upsert with unique constraint');

			// Build conditions from unique object
			const conditions: string[] = ['name = $1'];
			const params: unknown[] = [props.name];
			let paramIndex = 2;

			for (const [key, value] of Object.entries(unique)) {
				if (key.startsWith('data.')) {
					// Handle data sub-paths like 'data.userId'
					const dataPath = key.substring(5);
					conditions.push(`data->>'${dataPath}' = $${paramIndex++}`);
					params.push(String(value));
				} else {
					// Direct column (snake_case conversion)
					const columnName = key.replace(/([A-Z])/g, '_$1').toLowerCase();
					conditions.push(`${columnName} = $${paramIndex++}`);
					params.push(value);
				}
			}

			// Check if record exists
			const existingResult = await this.pool.query<IPostgresJobRow>(
				`SELECT * FROM "${this.tableName}" WHERE ${conditions.join(' AND ')} LIMIT 1`,
				params
			);

			if (existingResult.rows.length > 0) {
				// Record exists
				if (uniqueOpts?.insertOnly) {
					// Return existing record without update
					return this.rowToJob<DATA>(existingResult.rows[0]);
				}

				// Update existing record
				const updateResult = await this.pool.query<IPostgresJobRow>(
					`UPDATE "${this.tableName}"
					 SET priority = $${paramIndex},
						 next_run_at = $${paramIndex + 1},
						 type = $${paramIndex + 2},
						 repeat_timezone = $${paramIndex + 3},
						 repeat_interval = $${paramIndex + 4},
						 data = $${paramIndex + 5},
						 repeat_at = $${paramIndex + 6},
						 disabled = $${paramIndex + 7},
						 fork = $${paramIndex + 8},
						 last_modified_by = $${paramIndex + 9}
					 WHERE ${conditions.join(' AND ')}
					 RETURNING *`,
					[
						...params,
						props.priority,
						props.nextRunAt || null,
						props.type,
						props.repeatTimezone || null,
						props.repeatInterval || null,
						JSON.stringify(props.data),
						props.repeatAt || null,
						props.disabled || false,
						props.fork || false,
						options?.lastModifiedBy || null
					]
				);

				return this.rowToJob<DATA>(updateResult.rows[0]);
			}
		}

		// Insert new job
		log('inserting new job');
		const result = await this.pool.query<IPostgresJobRow>(
			`INSERT INTO "${this.tableName}" (
				name, priority, next_run_at, type, repeat_timezone,
				repeat_interval, data, repeat_at, disabled, fork, last_modified_by
			 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			 RETURNING *`,
			[
				props.name,
				props.priority,
				props.nextRunAt || null,
				props.type,
				props.repeatTimezone || null,
				props.repeatInterval || null,
				JSON.stringify(props.data),
				props.repeatAt || null,
				props.disabled || false,
				props.fork || false,
				options?.lastModifiedBy || null
			]
		);

		return this.rowToJob<DATA>(result.rows[0]);
	}
}
