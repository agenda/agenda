import debug from 'debug';
import { Redis } from 'ioredis';
import { randomUUID } from 'crypto';
import { toJobId, computeJobState } from 'agenda';
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
import type { IRedisBackendConfig, IRedisJobData } from './types.js';

const log = debug('agenda:redis:repository');

/**
 * Redis implementation of IJobRepository
 *
 * Data structure:
 * - `{prefix}job:{id}` - Hash containing job data
 * - `{prefix}jobs:all` - Set of all job IDs
 * - `{prefix}jobs:by_name:{name}` - Set of job IDs by name
 * - `{prefix}jobs:by_next_run_at` - Sorted set of job IDs by nextRunAt timestamp
 * - `{prefix}jobs:single:{name}` - String storing ID of single-type job for a name
 */
export class RedisJobRepository implements IJobRepository {
	private redis: Redis;
	private ownClient: boolean;
	private keyPrefix: string;
	private sort: { nextRunAt?: 1 | -1; priority?: 1 | -1 };

	constructor(private config: IRedisBackendConfig) {
		this.keyPrefix = config.keyPrefix || 'agenda:';
		this.sort = config.sort || { nextRunAt: 1, priority: -1 };

		// Use existing client or create a new one
		if (config.redis) {
			this.redis = config.redis;
			this.ownClient = false;
		} else if (config.connectionString) {
			this.redis = new Redis(config.connectionString);
			this.ownClient = true;
		} else if (config.redisOptions) {
			this.redis = new Redis(config.redisOptions);
			this.ownClient = true;
		} else {
			throw new Error('RedisBackend requires redis, connectionString, or redisOptions');
		}
	}

	/**
	 * Get the underlying Redis client (for use by notification channel)
	 */
	getRedis(): Redis {
		return this.redis;
	}

	/**
	 * Generate Redis key with prefix
	 */
	private key(suffix: string): string {
		return `${this.keyPrefix}${suffix}`;
	}

	async connect(): Promise<void> {
		log('connecting to Redis');

		// Test connection
		await this.redis.ping();
		log('connection successful');
	}

	async disconnect(): Promise<void> {
		log('disconnecting from Redis');
		// Only close the client if we created it
		if (this.ownClient) {
			this.redis.disconnect();
		}
	}

	/**
	 * Convert Redis hash data to IJobParameters
	 */
	private hashToJob<DATA = unknown>(data: Record<string, string>): IJobParameters<DATA> {
		return {
			_id: toJobId(data.id) as JobId,
			name: data.name,
			priority: parseInt(data.priority, 10),
			nextRunAt: data.nextRunAt && data.nextRunAt !== 'null' ? new Date(data.nextRunAt) : null,
			type: data.type as 'normal' | 'single',
			lockedAt:
				data.lockedAt && data.lockedAt !== 'null' ? new Date(data.lockedAt) : undefined,
			lastFinishedAt:
				data.lastFinishedAt && data.lastFinishedAt !== 'null'
					? new Date(data.lastFinishedAt)
					: undefined,
			failedAt:
				data.failedAt && data.failedAt !== 'null' ? new Date(data.failedAt) : undefined,
			failCount:
				data.failCount && data.failCount !== 'null'
					? parseInt(data.failCount, 10)
					: undefined,
			failReason:
				data.failReason && data.failReason !== 'null' ? data.failReason : undefined,
			repeatTimezone:
				data.repeatTimezone && data.repeatTimezone !== 'null'
					? data.repeatTimezone
					: undefined,
			lastRunAt:
				data.lastRunAt && data.lastRunAt !== 'null' ? new Date(data.lastRunAt) : undefined,
			repeatInterval:
				data.repeatInterval && data.repeatInterval !== 'null'
					? data.repeatInterval
					: undefined,
			data: JSON.parse(data.data || '{}') as DATA,
			repeatAt: data.repeatAt && data.repeatAt !== 'null' ? data.repeatAt : undefined,
			disabled: data.disabled === 'true',
			progress:
				data.progress && data.progress !== 'null' ? parseFloat(data.progress) : undefined,
			lastModifiedBy:
				data.lastModifiedBy && data.lastModifiedBy !== 'null'
					? data.lastModifiedBy
					: undefined
		};
	}

	/**
	 * Convert IJobParameters to Redis hash data
	 */
	private jobToHash<DATA = unknown>(
		job: IJobParameters<DATA>,
		id: string,
		lastModifiedBy: string | undefined
	): IRedisJobData {
		const now = new Date().toISOString();
		return {
			id,
			name: job.name,
			priority: String(job.priority ?? 0),
			nextRunAt: job.nextRunAt?.toISOString() || 'null',
			type: job.type || 'normal',
			lockedAt: job.lockedAt?.toISOString() || 'null',
			lastFinishedAt: job.lastFinishedAt?.toISOString() || 'null',
			failedAt: job.failedAt?.toISOString() || 'null',
			failCount: job.failCount !== undefined ? String(job.failCount) : 'null',
			failReason: job.failReason ?? 'null',
			repeatTimezone: job.repeatTimezone ?? 'null',
			lastRunAt: job.lastRunAt?.toISOString() || 'null',
			repeatInterval: job.repeatInterval !== undefined ? String(job.repeatInterval) : 'null',
			data: JSON.stringify(job.data ?? {}),
			repeatAt: job.repeatAt ?? 'null',
			disabled: String(job.disabled ?? false),
			progress: job.progress !== undefined ? String(job.progress) : 'null',
			lastModifiedBy: lastModifiedBy ?? 'null',
			createdAt: now,
			updatedAt: now
		};
	}

	/**
	 * Get score for sorted set based on nextRunAt and priority
	 * Score format: timestamp.priority (e.g., 1234567890.005 for priority 5)
	 */
	private getJobScore(nextRunAt: Date | null, priority: number): number {
		if (!nextRunAt) {
			return Number.MAX_SAFE_INTEGER; // Jobs without nextRunAt go to the end
		}
		// Combine timestamp with priority as decimal part
		// Higher priority = lower decimal = comes first when sorting ascending
		const priorityPart = (100 - Math.min(Math.max(priority, 0), 99)) / 1000;
		return nextRunAt.getTime() + priorityPart;
	}

	async getJobById(id: string): Promise<IJobParameters | null> {
		const data = await this.redis.hgetall(this.key(`job:${id}`));

		if (!data || Object.keys(data).length === 0) {
			return null;
		}

		return this.hashToJob(data);
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

		// Get all job IDs to filter
		let jobIds: string[];

		if (id) {
			jobIds = [id];
		} else if (ids && ids.length > 0) {
			jobIds = ids.map((i: string | JobId) => i.toString());
		} else if (name) {
			jobIds = await this.redis.smembers(this.key(`jobs:by_name:${name}`));
		} else if (names && names.length > 0) {
			const sets = names.map((n: string) => this.key(`jobs:by_name:${n}`));
			jobIds = await this.redis.sunion(...sets);
		} else {
			jobIds = await this.redis.smembers(this.key('jobs:all'));
		}

		// Fetch all jobs
		const jobs: IJobWithState[] = [];
		for (const jobId of jobIds) {
			const jobData = await this.redis.hgetall(this.key(`job:${jobId}`));
			if (!jobData || Object.keys(jobData).length === 0) continue;

			const job = this.hashToJob(jobData);

			// Apply filters
			if (!includeDisabled && job.disabled) continue;
			if (search && !job.name.toLowerCase().includes(search.toLowerCase())) continue;
			if (data !== undefined) {
				const jobDataStr = JSON.stringify(job.data);
				const searchDataStr = JSON.stringify(data);
				if (!jobDataStr.includes(searchDataStr.slice(1, -1))) continue;
			}

			const jobState = computeJobState(job, now);
			if (state && jobState !== state) continue;

			jobs.push({
				...job,
				_id: job._id as JobId,
				state: jobState
			});
		}

		// Sort jobs
		this.sortJobs(jobs, sort);

		// Apply pagination
		const total = jobs.length;
		let result = jobs;
		if (limit > 0) {
			result = jobs.slice(skip, skip + limit);
		} else if (skip > 0) {
			result = jobs.slice(skip);
		}

		return { jobs: result, total };
	}

	private sortJobs(jobs: IJobWithState[], sort?: IJobsSort): void {
		jobs.sort((a, b) => {
			if (sort) {
				if (sort.nextRunAt !== undefined) {
					const aTime = a.nextRunAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
					const bTime = b.nextRunAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
					const cmp = sort.nextRunAt === 1 ? aTime - bTime : bTime - aTime;
					if (cmp !== 0) return cmp;
				}
				if (sort.priority !== undefined) {
					const cmp = sort.priority === 1 ? a.priority - b.priority : b.priority - a.priority;
					if (cmp !== 0) return cmp;
				}
				if (sort.lastRunAt !== undefined) {
					const aTime = a.lastRunAt?.getTime() ?? 0;
					const bTime = b.lastRunAt?.getTime() ?? 0;
					const cmp = sort.lastRunAt === 1 ? aTime - bTime : bTime - aTime;
					if (cmp !== 0) return cmp;
				}
				if (sort.lastFinishedAt !== undefined) {
					const aTime = a.lastFinishedAt?.getTime() ?? 0;
					const bTime = b.lastFinishedAt?.getTime() ?? 0;
					const cmp = sort.lastFinishedAt === 1 ? aTime - bTime : bTime - aTime;
					if (cmp !== 0) return cmp;
				}
				if (sort.name !== undefined) {
					const cmp = a.name.localeCompare(b.name);
					return sort.name === 1 ? cmp : -cmp;
				}
			}
			// Default sort: nextRunAt DESC, lastRunAt DESC
			const aNextRun = a.nextRunAt?.getTime() ?? 0;
			const bNextRun = b.nextRunAt?.getTime() ?? 0;
			if (aNextRun !== bNextRun) return bNextRun - aNextRun;
			const aLastRun = a.lastRunAt?.getTime() ?? 0;
			const bLastRun = b.lastRunAt?.getTime() ?? 0;
			return bLastRun - aLastRun;
		});
	}

	async getJobsOverview(): Promise<IJobsOverview[]> {
		const now = new Date();
		const names = await this.getDistinctJobNames();

		const overviews = await Promise.all(
			names.map(async (name: string) => {
				const jobIds = await this.redis.smembers(this.key(`jobs:by_name:${name}`));

				const overview: IJobsOverview = {
					name,
					total: jobIds.length,
					running: 0,
					scheduled: 0,
					queued: 0,
					completed: 0,
					failed: 0,
					repeating: 0
				};

				for (const jobId of jobIds) {
					const jobData = await this.redis.hgetall(this.key(`job:${jobId}`));
					if (!jobData || Object.keys(jobData).length === 0) continue;

					const job = this.hashToJob(jobData);
					const state = computeJobState(job, now);
					overview[state as keyof typeof overview]++;
				}

				return overview;
			})
		);

		return overviews;
	}

	async getDistinctJobNames(): Promise<string[]> {
		const pattern = this.key('jobs:by_name:*');
		const keys = await this.redis.keys(pattern);
		const prefix = this.key('jobs:by_name:');
		return keys.map((k: string) => k.slice(prefix.length)).sort();
	}

	async getQueueSize(): Promise<number> {
		const now = Date.now();
		// Get jobs with nextRunAt < now using the sorted set
		const jobIds = await this.redis.zrangebyscore(
			this.key('jobs:by_next_run_at'),
			0,
			now
		);
		return jobIds.length;
	}

	async removeJobs(options: IRemoveJobsOptions): Promise<number> {
		let jobIds: string[] = [];

		if (options.id) {
			jobIds = [options.id.toString()];
		} else if (options.ids && options.ids.length > 0) {
			jobIds = options.ids.map((id: JobId | string) => id.toString());
		} else if (options.name) {
			jobIds = await this.redis.smembers(this.key(`jobs:by_name:${options.name}`));
		} else if (options.names && options.names.length > 0) {
			const sets = options.names.map((n: string) => this.key(`jobs:by_name:${n}`));
			jobIds = await this.redis.sunion(...sets);
		} else if (options.notNames && options.notNames.length > 0) {
			const allIds = await this.redis.smembers(this.key('jobs:all'));
			const excludeSets = options.notNames.map((n: string) => this.key(`jobs:by_name:${n}`));
			const excludeIds = new Set(await this.redis.sunion(...excludeSets));
			jobIds = allIds.filter((id: string) => !excludeIds.has(id));
		} else if (options.data !== undefined) {
			// Need to scan all jobs for data match
			const allIds = await this.redis.smembers(this.key('jobs:all'));
			const searchDataStr = JSON.stringify(options.data);
			for (const jobId of allIds) {
				const jobData = await this.redis.hget(this.key(`job:${jobId}`), 'data');
				if (jobData && jobData.includes(searchDataStr.slice(1, -1))) {
					jobIds.push(jobId);
				}
			}
		} else {
			// No criteria - don't delete anything
			return 0;
		}

		if (jobIds.length === 0) {
			return 0;
		}

		let removed = 0;
		for (const jobId of jobIds) {
			const jobData = await this.redis.hgetall(this.key(`job:${jobId}`));
			if (!jobData || Object.keys(jobData).length === 0) continue;

			const job = this.hashToJob(jobData);
			await this.deleteJob(jobId, job.name, job.type);
			removed++;
		}

		return removed;
	}

	private async deleteJob(id: string, name: string, type: string): Promise<void> {
		const pipeline = this.redis.pipeline();

		// Delete the job hash
		pipeline.del(this.key(`job:${id}`));

		// Remove from indexes
		pipeline.srem(this.key('jobs:all'), id);
		pipeline.srem(this.key(`jobs:by_name:${name}`), id);
		pipeline.zrem(this.key('jobs:by_next_run_at'), id);

		// Remove single job reference if applicable
		if (type === 'single') {
			pipeline.del(this.key(`jobs:single:${name}`));
		}

		await pipeline.exec();
	}

	async unlockJob(job: IJobParameters): Promise<void> {
		if (!job._id) return;

		const jobId = job._id.toString();

		// Only unlock jobs which are not currently processed (nextRunAt is not null)
		const nextRunAt = await this.redis.hget(this.key(`job:${jobId}`), 'nextRunAt');
		if (nextRunAt && nextRunAt !== 'null') {
			await this.redis.hset(this.key(`job:${jobId}`), 'lockedAt', 'null');
		}
	}

	async unlockJobs(jobIds: (JobId | string)[]): Promise<void> {
		if (jobIds.length === 0) return;

		for (const jobId of jobIds) {
			const id = jobId.toString();
			const nextRunAt = await this.redis.hget(this.key(`job:${id}`), 'nextRunAt');
			if (nextRunAt && nextRunAt !== 'null') {
				await this.redis.hset(this.key(`job:${id}`), 'lockedAt', 'null');
			}
		}
	}

	async lockJob(
		job: IJobParameters,
		options: IJobRepositoryOptions | undefined
	): Promise<IJobParameters | undefined> {
		if (!job._id) return undefined;

		const jobId = job._id.toString();
		const now = new Date();

		// Use WATCH/MULTI/EXEC for atomic check-and-set
		await this.redis.watch(this.key(`job:${jobId}`));

		try {
			const jobData = await this.redis.hgetall(this.key(`job:${jobId}`));
			if (!jobData || Object.keys(jobData).length === 0) {
				await this.redis.unwatch();
				return undefined;
			}

			// Check conditions
			if (jobData.lockedAt !== 'null') {
				await this.redis.unwatch();
				return undefined;
			}
			if (jobData.disabled === 'true') {
				await this.redis.unwatch();
				return undefined;
			}
			if (jobData.name !== job.name) {
				await this.redis.unwatch();
				return undefined;
			}
			if (job.nextRunAt) {
				const storedNextRunAt = jobData.nextRunAt !== 'null' ? new Date(jobData.nextRunAt) : null;
				if (!storedNextRunAt || storedNextRunAt.getTime() !== job.nextRunAt.getTime()) {
					await this.redis.unwatch();
					return undefined;
				}
			}

			// Lock the job atomically
			const result = await this.redis
				.multi()
				.hset(this.key(`job:${jobId}`), 'lockedAt', now.toISOString())
				.hset(this.key(`job:${jobId}`), 'lastModifiedBy', options?.lastModifiedBy ?? 'null')
				.hset(this.key(`job:${jobId}`), 'updatedAt', now.toISOString())
				.exec();

			if (!result) {
				// Transaction was aborted (key was modified)
				return undefined;
			}

			// Return the updated job
			const updatedData = await this.redis.hgetall(this.key(`job:${jobId}`));
			return this.hashToJob(updatedData);
		} catch {
			await this.redis.unwatch();
			return undefined;
		}
	}

	async getNextJobToRun(
		jobName: string,
		nextScanAt: Date,
		lockDeadline: Date,
		now: Date | undefined,
		options: IJobRepositoryOptions | undefined
	): Promise<IJobParameters | undefined> {
		const lockTime = now ?? new Date();

		// Get job IDs by name
		const jobIds = await this.redis.smembers(this.key(`jobs:by_name:${jobName}`));

		// Sort by nextRunAt and priority
		const candidates: { id: string; score: number }[] = [];
		for (const jobId of jobIds) {
			const score = await this.redis.zscore(this.key('jobs:by_next_run_at'), jobId);
			if (score !== null) {
				candidates.push({ id: jobId, score: parseFloat(score) });
			}
		}

		// Sort candidates
		if (this.sort.nextRunAt === 1) {
			candidates.sort((a, b) => a.score - b.score);
		} else {
			candidates.sort((a, b) => b.score - a.score);
		}

		// Try to lock each candidate
		for (const candidate of candidates) {
			await this.redis.watch(this.key(`job:${candidate.id}`));

			try {
				const jobData = await this.redis.hgetall(this.key(`job:${candidate.id}`));
				if (!jobData || Object.keys(jobData).length === 0) {
					await this.redis.unwatch();
					continue;
				}

				// Check if job is eligible
				if (jobData.disabled === 'true') {
					await this.redis.unwatch();
					continue;
				}

				const lockedAt = jobData.lockedAt !== 'null' ? new Date(jobData.lockedAt) : null;
				const nextRunAt = jobData.nextRunAt !== 'null' ? new Date(jobData.nextRunAt) : null;

				// Check if job is ready to run
				const isUnlockedAndReady = !lockedAt && nextRunAt && nextRunAt <= nextScanAt;
				const isStale = lockedAt && lockedAt <= lockDeadline;

				if (!isUnlockedAndReady && !isStale) {
					await this.redis.unwatch();
					continue;
				}

				// Lock the job atomically
				const result = await this.redis
					.multi()
					.hset(this.key(`job:${candidate.id}`), 'lockedAt', lockTime.toISOString())
					.hset(this.key(`job:${candidate.id}`), 'lastModifiedBy', options?.lastModifiedBy ?? 'null')
					.hset(this.key(`job:${candidate.id}`), 'updatedAt', lockTime.toISOString())
					.exec();

				if (!result) {
					// Transaction was aborted (key was modified)
					continue;
				}

				// Return the updated job
				const updatedData = await this.redis.hgetall(this.key(`job:${candidate.id}`));
				return this.hashToJob(updatedData);
			} catch {
				await this.redis.unwatch();
				continue;
			}
		}

		return undefined;
	}

	async saveJobState(
		job: IJobParameters,
		options: IJobRepositoryOptions | undefined
	): Promise<void> {
		if (!job._id) {
			throw new Error('Cannot save job state without job ID');
		}

		const jobId = job._id.toString();
		const now = new Date().toISOString();

		// Check if job exists
		const exists = await this.redis.exists(this.key(`job:${jobId}`));
		if (!exists) {
			throw new Error(
				`job ${job._id} (name: ${job.name}) cannot be updated in the database, maybe it does not exist anymore?`
			);
		}

		// Update state fields
		const updates: Record<string, string> = {
			lockedAt: job.lockedAt?.toISOString() || 'null',
			nextRunAt: job.nextRunAt?.toISOString() || 'null',
			lastRunAt: job.lastRunAt?.toISOString() || 'null',
			progress: job.progress !== undefined ? String(job.progress) : 'null',
			failReason: job.failReason ?? 'null',
			failCount: job.failCount !== undefined ? String(job.failCount) : 'null',
			failedAt: job.failedAt?.toISOString() || 'null',
			lastFinishedAt: job.lastFinishedAt?.toISOString() || 'null',
			lastModifiedBy: options?.lastModifiedBy ?? 'null',
			updatedAt: now
		};

		await this.redis.hset(this.key(`job:${jobId}`), updates);

		// Update the sorted set score for nextRunAt
		if (job.nextRunAt) {
			const score = this.getJobScore(job.nextRunAt, job.priority);
			await this.redis.zadd(this.key('jobs:by_next_run_at'), score, jobId);
		} else {
			await this.redis.zadd(
				this.key('jobs:by_next_run_at'),
				Number.MAX_SAFE_INTEGER,
				jobId
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
			const jobId = _id.toString();

			const existingData = await this.redis.hgetall(this.key(`job:${jobId}`));
			if (!existingData || Object.keys(existingData).length === 0) {
				log('job %s was not found for update, returning original data', _id);
				return job;
			}

			// Verify name matches
			if (existingData.name !== props.name) {
				log('job %s name mismatch, returning original data', _id);
				return job;
			}

			// Update the job
			const now = new Date().toISOString();
			const updates: Record<string, string> = {
				priority: String(props.priority ?? 0),
				nextRunAt: props.nextRunAt?.toISOString() || 'null',
				type: props.type || 'normal',
				repeatTimezone: props.repeatTimezone ?? 'null',
				repeatInterval: props.repeatInterval !== undefined ? String(props.repeatInterval) : 'null',
				data: JSON.stringify(props.data ?? {}),
				repeatAt: props.repeatAt ?? 'null',
				disabled: String(props.disabled ?? false),
				lastModifiedBy: options?.lastModifiedBy ?? 'null',
				updatedAt: now
			};

			await this.redis.hset(this.key(`job:${jobId}`), updates);

			// Update sorted set
			const score = this.getJobScore(props.nextRunAt ?? null, props.priority ?? 0);
			await this.redis.zadd(this.key('jobs:by_next_run_at'), score, jobId);

			const updatedData = await this.redis.hgetall(this.key(`job:${jobId}`));
			return this.hashToJob<DATA>(updatedData);
		}

		// Handle 'single' type jobs - upsert by name
		if (props.type === 'single') {
			log('job with type of "single" found');

			const existingId = await this.redis.get(this.key(`jobs:single:${props.name}`));
			if (existingId) {
				const existingData = await this.redis.hgetall(this.key(`job:${existingId}`));
				if (existingData && Object.keys(existingData).length > 0) {
					// Update existing single job
					const now = new Date();
					const shouldProtectNextRunAt = props.nextRunAt && props.nextRunAt <= now;

					const updates: Record<string, string> = {
						priority: String(props.priority ?? 0),
						repeatTimezone: props.repeatTimezone ?? 'null',
						repeatInterval: props.repeatInterval !== undefined ? String(props.repeatInterval) : 'null',
						data: JSON.stringify(props.data ?? {}),
						repeatAt: props.repeatAt ?? 'null',
						disabled: String(props.disabled ?? false),
						lastModifiedBy: options?.lastModifiedBy ?? 'null',
						updatedAt: now.toISOString()
					};

					// Only update nextRunAt if not protecting it
					if (!shouldProtectNextRunAt || existingData.nextRunAt === 'null') {
						updates.nextRunAt = props.nextRunAt?.toISOString() || 'null';
					}

					await this.redis.hset(this.key(`job:${existingId}`), updates);

					// Update sorted set
					const nextRunAt =
						updates.nextRunAt !== undefined
							? updates.nextRunAt
							: existingData.nextRunAt;
					const nextRunAtDate =
						nextRunAt !== 'null' ? new Date(nextRunAt) : null;
					const score = this.getJobScore(nextRunAtDate, props.priority ?? 0);
					await this.redis.zadd(this.key('jobs:by_next_run_at'), score, existingId);

					const updatedData = await this.redis.hgetall(this.key(`job:${existingId}`));
					return this.hashToJob<DATA>(updatedData);
				}
			}

			// Create new single job
			const newId = randomUUID();
			const hashData = this.jobToHash(props as IJobParameters<DATA>, newId, options?.lastModifiedBy);

			await this.redis.hset(this.key(`job:${newId}`), hashData as unknown as Record<string, string>);
			await this.redis.sadd(this.key('jobs:all'), newId);
			await this.redis.sadd(this.key(`jobs:by_name:${props.name}`), newId);
			await this.redis.set(this.key(`jobs:single:${props.name}`), newId);

			const score = this.getJobScore(props.nextRunAt ?? null, props.priority ?? 0);
			await this.redis.zadd(this.key('jobs:by_next_run_at'), score, newId);

			const savedData = await this.redis.hgetall(this.key(`job:${newId}`));
			return this.hashToJob<DATA>(savedData);
		}

		// Handle unique constraint
		if (unique) {
			log('calling upsert with unique constraint');

			// Build query to find existing job
			const allIds = await this.redis.smembers(this.key(`jobs:by_name:${props.name}`));

			for (const jobId of allIds) {
				const jobData = await this.redis.hgetall(this.key(`job:${jobId}`));
				if (!jobData || Object.keys(jobData).length === 0) continue;

				let matches = true;
				for (const [key, value] of Object.entries(unique)) {
					if (key.startsWith('data.')) {
						const dataPath = key.substring(5);
						const data = JSON.parse(jobData.data || '{}');
						if (data[dataPath] !== value) {
							matches = false;
							break;
						}
					} else {
						const fieldMap: Record<string, string> = {
							nextRunAt: 'nextRunAt',
							priority: 'priority',
							type: 'type'
						};
						const field = fieldMap[key] || key;
						if (jobData[field] !== String(value)) {
							matches = false;
							break;
						}
					}
				}

				if (matches) {
					if (uniqueOpts?.insertOnly) {
						return this.hashToJob<DATA>(jobData);
					}

					// Update existing job
					const now = new Date().toISOString();
					const updates: Record<string, string> = {
						priority: String(props.priority ?? 0),
						nextRunAt: props.nextRunAt?.toISOString() || 'null',
						type: props.type || 'normal',
						repeatTimezone: props.repeatTimezone ?? 'null',
						repeatInterval: props.repeatInterval !== undefined ? String(props.repeatInterval) : 'null',
						data: JSON.stringify(props.data ?? {}),
						repeatAt: props.repeatAt ?? 'null',
						disabled: String(props.disabled ?? false),
						lastModifiedBy: options?.lastModifiedBy ?? 'null',
						updatedAt: now
					};

					await this.redis.hset(this.key(`job:${jobId}`), updates);

					const score = this.getJobScore(props.nextRunAt ?? null, props.priority ?? 0);
					await this.redis.zadd(this.key('jobs:by_next_run_at'), score, jobId);

					const updatedData = await this.redis.hgetall(this.key(`job:${jobId}`));
					return this.hashToJob<DATA>(updatedData);
				}
			}
		}

		// Insert new job
		log('inserting new job');
		const newId = randomUUID();
		const hashData = this.jobToHash(props as IJobParameters<DATA>, newId, options?.lastModifiedBy);

		await this.redis.hset(this.key(`job:${newId}`), hashData as unknown as Record<string, string>);
		await this.redis.sadd(this.key('jobs:all'), newId);
		await this.redis.sadd(this.key(`jobs:by_name:${props.name}`), newId);

		const score = this.getJobScore(props.nextRunAt ?? null, props.priority ?? 0);
		await this.redis.zadd(this.key('jobs:by_next_run_at'), score, newId);

		const savedData = await this.redis.hgetall(this.key(`job:${newId}`));
		return this.hashToJob<DATA>(savedData);
	}
}
