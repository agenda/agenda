import debug from 'debug';
import type { Pool } from 'pg';
import type { JobLogger, JobLogEntry, JobLogQuery, JobLogQueryResult, LogLevel, JobLogEvent } from 'agenda';

const log = debug('agenda:postgres:logger');

/**
 * SQL schema for the job logs table.
 */
export function getCreateLogsTableSQL(tableName: string): string {
	return `
		CREATE TABLE IF NOT EXISTS "${tableName}" (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			level VARCHAR(10) NOT NULL,
			event VARCHAR(30) NOT NULL,
			job_id VARCHAR(255),
			job_name VARCHAR(255) NOT NULL,
			message TEXT NOT NULL,
			duration INTEGER,
			error TEXT,
			fail_count INTEGER,
			retry_delay INTEGER,
			retry_attempt INTEGER,
			agenda_name VARCHAR(255),
			meta JSONB
		);
	`;
}

/**
 * SQL indexes for the job logs table.
 */
export function getCreateLogsIndexesSQL(tableName: string): string[] {
	return [
		`CREATE INDEX IF NOT EXISTS "${tableName}_timestamp_idx"
		 ON "${tableName}" (timestamp DESC)`,
		`CREATE INDEX IF NOT EXISTS "${tableName}_job_id_idx"
		 ON "${tableName}" (job_id, timestamp DESC)`,
		`CREATE INDEX IF NOT EXISTS "${tableName}_job_name_idx"
		 ON "${tableName}" (job_name, timestamp DESC)`
	];
}

/**
 * PostgreSQL implementation of JobLogger.
 * Stores job lifecycle events in a dedicated PostgreSQL table.
 *
 * @example
 * ```typescript
 * // Via backend (automatic connection sharing):
 * import { PostgresBackend } from '@agendajs/postgres-backend';
 *
 * const backend = new PostgresBackend({
 *   connectionString: 'postgresql://...',
 *   logging: true // enables PostgresJobLogger with 'agenda_logs' table
 * });
 *
 * // Standalone (e.g., log to Postgres while using Mongo for storage):
 * import { PostgresJobLogger } from '@agendajs/postgres-backend';
 * import { Pool } from 'pg';
 *
 * const logger = new PostgresJobLogger({ pool: new Pool({ connectionString: '...' }) });
 * const agenda = new Agenda({
 *   backend: new MongoBackend({ address: 'mongodb://...' }),
 *   logging: logger
 * });
 * ```
 */
export class PostgresJobLogger implements JobLogger {
	private pool!: Pool;
	private readonly tableName: string;
	private readonly ensureSchema: boolean;
	private initialized = false;

	constructor(options?: { pool?: Pool; tableName?: string; ensureSchema?: boolean } | string) {
		if (typeof options === 'string') {
			// Legacy: constructor(tableName)
			this.tableName = options;
			this.ensureSchema = true;
		} else {
			this.tableName = options?.tableName ?? 'agenda_logs';
			this.ensureSchema = options?.ensureSchema ?? true;
			if (options?.pool) {
				this.pool = options.pool;
			}
		}
	}

	/**
	 * Set the pool and initialize the table schema.
	 * Called by PostgresBackend after the repository connects,
	 * or automatically when a pool is provided in the constructor.
	 */
	async setPool(pool: Pool): Promise<void> {
		this.pool = pool;
		await this.ensureInitialized();
	}

	private async ensureInitialized(): Promise<void> {
		if (this.initialized || !this.pool || !this.ensureSchema) return;
		this.initialized = true;

		log('creating schema for %s table', this.tableName);
		const client = await this.pool.connect();
		try {
			await client.query(getCreateLogsTableSQL(this.tableName));
			for (const sql of getCreateLogsIndexesSQL(this.tableName)) {
				await client.query(sql);
			}
			log('schema created for %s table', this.tableName);
		} finally {
			client.release();
		}
	}

	async log(entry: Omit<JobLogEntry, '_id'>): Promise<void> {
		if (!this.pool) {
			log('pool not initialized, skipping log entry');
			return;
		}

		await this.ensureInitialized();

		await this.pool.query(
			`INSERT INTO "${this.tableName}"
			 (timestamp, level, event, job_id, job_name, message, duration, error, fail_count, retry_delay, retry_attempt, agenda_name, meta)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
			[
				entry.timestamp,
				entry.level,
				entry.event,
				entry.jobId ?? null,
				entry.jobName,
				entry.message,
				entry.duration ?? null,
				entry.error ?? null,
				entry.failCount ?? null,
				entry.retryDelay ?? null,
				entry.retryAttempt ?? null,
				entry.agendaName ?? null,
				entry.meta ? JSON.stringify(entry.meta) : null
			]
		);
	}

	async getLogs(query?: JobLogQuery): Promise<JobLogQueryResult> {
		if (!this.pool) {
			return { entries: [], total: 0 };
		}

		const { where, params } = this.buildWhere(query);
		const sort = query?.sort === 'asc' ? 'ASC' : 'DESC';
		const limit = query?.limit ?? 50;
		const offset = query?.offset ?? 0;

		const entriesQuery = `
			SELECT * FROM "${this.tableName}"
			${where}
			ORDER BY timestamp ${sort}
			LIMIT $${params.length + 1} OFFSET $${params.length + 2}
		`;
		const countQuery = `SELECT COUNT(*)::int as total FROM "${this.tableName}" ${where}`;

		const [entriesResult, countResult] = await Promise.all([
			this.pool.query(entriesQuery, [...params, limit, offset]),
			this.pool.query(countQuery, params)
		]);

		const entries: JobLogEntry[] = entriesResult.rows.map(row => ({
			_id: row.id,
			timestamp: row.timestamp,
			level: row.level as LogLevel,
			event: row.event as JobLogEvent,
			jobId: row.job_id ?? undefined,
			jobName: row.job_name,
			message: row.message,
			duration: row.duration ?? undefined,
			error: row.error ?? undefined,
			failCount: row.fail_count ?? undefined,
			retryDelay: row.retry_delay ?? undefined,
			retryAttempt: row.retry_attempt ?? undefined,
			agendaName: row.agenda_name ?? undefined,
			meta: row.meta ?? undefined
		}));

		return { entries, total: countResult.rows[0].total };
	}

	async clearLogs(query?: JobLogQuery): Promise<number> {
		if (!this.pool) {
			return 0;
		}

		const { where, params } = this.buildWhere(query);
		const result = await this.pool.query(
			`DELETE FROM "${this.tableName}" ${where}`,
			params
		);
		return result.rowCount ?? 0;
	}

	private buildWhere(query?: JobLogQuery): { where: string; params: unknown[] } {
		if (!query) return { where: '', params: [] };

		const conditions: string[] = [];
		const params: unknown[] = [];
		let paramIndex = 1;

		if (query.jobId) {
			conditions.push(`job_id = $${paramIndex++}`);
			params.push(query.jobId);
		}
		if (query.jobName) {
			conditions.push(`job_name = $${paramIndex++}`);
			params.push(query.jobName);
		}
		if (query.level) {
			if (Array.isArray(query.level)) {
				conditions.push(`level = ANY($${paramIndex++})`);
				params.push(query.level);
			} else {
				conditions.push(`level = $${paramIndex++}`);
				params.push(query.level);
			}
		}
		if (query.event) {
			if (Array.isArray(query.event)) {
				conditions.push(`event = ANY($${paramIndex++})`);
				params.push(query.event);
			} else {
				conditions.push(`event = $${paramIndex++}`);
				params.push(query.event);
			}
		}
		if (query.from) {
			conditions.push(`timestamp >= $${paramIndex++}`);
			params.push(query.from);
		}
		if (query.to) {
			conditions.push(`timestamp <= $${paramIndex++}`);
			params.push(query.to);
		}

		const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
		return { where, params };
	}
}
