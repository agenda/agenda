import debug from 'debug';
import { Redis } from 'ioredis';
import { randomUUID } from 'crypto';
import { toJobId, computeJobState } from 'agenda';
import type {
	JobRepository,
	JobRepositoryOptions,
	RemoveJobsOptions,
	JobParameters,
	JobId,
	JobsQueryOptions,
	JobsResult,
	JobsOverview,
	JobWithState,
	JobsSort,
	SortDirection
} from 'agenda';
import type { RedisBackendConfig, RedisJobData } from './types.js';

const log = debug('agenda:redis:repository');

/**
 * Redis implementation of JobRepository
 *
 * Data structure:
 * - `{prefix}job:{id}` - Hash containing job data
 * - `{prefix}jobs:all` - Set of all job IDs
 * - `{prefix}jobs:by_name:{name}` - Set of job IDs by name
 * - `{prefix}jobs:by_next_run_at` - Sorted set of job IDs by nextRunAt timestamp
 * - `{prefix}jobs:single:{name}` - String storing ID of single-type job for a name
 */
export class RedisJobRepository implements JobRepository {
	private redis: Redis;
	private ownClient: boolean;
	private keyPrefix: string;
	private sort: { nextRunAt?: SortDirection; priority?: SortDirection };

	constructor(private config: RedisBackendConfig) {
		this.keyPrefix = config.keyPrefix || 'agenda:';
		this.sort = config.sort || { nextRunAt: 'asc', priority: 'desc' };

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
	 * Convert Redis hash data to JobParameters
	 */
	private hashToJob<DATA = unknown>(data: Record<string, string>): JobParameters<DATA> {
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
			fork: data.fork === 'true',
			lastModifiedBy:
				data.lastModifiedBy && data.lastModifiedBy !== 'null'
					? data.lastModifiedBy
					: undefined,
			debounceStartedAt:
				data.debounceStartedAt && data.debounceStartedAt !== 'null'
					? new Date(data.debounceStartedAt)
					: undefined
		};
	}

	/**
	 * Convert JobParameters to Redis hash data
	 */
	private jobToHash<DATA = unknown>(
		job: JobParameters<DATA>,
		id: string,
		lastModifiedBy: string | undefined
	): RedisJobData {
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
			fork: String(job.fork ?? false),
			lastModifiedBy: lastModifiedBy ?? 'null',
			debounceStartedAt: job.debounceStartedAt?.toISOString() || 'null',
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

	async getJobById(id: string): Promise<JobParameters | null> {
		const data = await this.redis.hgetall(this.key(`job:${id}`));

		if (!data || Object.keys(data).length === 0) {
			return null;
		}

		return this.hashToJob(data);
	}

	async queryJobs(options: JobsQueryOptions = {}): Promise<JobsResult> {
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
		const jobs: JobWithState[] = [];
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
			// Special handling for 'paused' state which is based on disabled field
			if (state) {
				if (state === 'paused') {
					if (job.disabled !== true) continue;
				} else if (jobState !== state) {
					continue;
				}
			}

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

	private sortJobs(jobs: JobWithState[], sort?: JobsSort): void {
		jobs.sort((a, b) => {
			if (sort) {
				if (sort.nextRunAt !== undefined) {
					const aTime = a.nextRunAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
					const bTime = b.nextRunAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
					const cmp = sort.nextRunAt === 'asc' ? aTime - bTime : bTime - aTime;
					if (cmp !== 0) return cmp;
				}
				if (sort.priority !== undefined) {
					const cmp = sort.priority === 'asc' ? a.priority - b.priority : b.priority - a.priority;
					if (cmp !== 0) return cmp;
				}
				if (sort.lastRunAt !== undefined) {
					const aTime = a.lastRunAt?.getTime() ?? 0;
					const bTime = b.lastRunAt?.getTime() ?? 0;
					const cmp = sort.lastRunAt === 'asc' ? aTime - bTime : bTime - aTime;
					if (cmp !== 0) return cmp;
				}
				if (sort.lastFinishedAt !== undefined) {
					const aTime = a.lastFinishedAt?.getTime() ?? 0;
					const bTime = b.lastFinishedAt?.getTime() ?? 0;
					const cmp = sort.lastFinishedAt === 'asc' ? aTime - bTime : bTime - aTime;
					if (cmp !== 0) return cmp;
				}
				if (sort.name !== undefined) {
					const cmp = a.name.localeCompare(b.name);
					return sort.name === 'asc' ? cmp : -cmp;
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

	async getJobsOverview(): Promise<JobsOverview[]> {
		const now = new Date();
		const names = await this.getDistinctJobNames();

		const overviews = await Promise.all(
			names.map(async (name: string) => {
				const jobIds = await this.redis.smembers(this.key(`jobs:by_name:${name}`));

				const overview: JobsOverview = {
					name,
					total: jobIds.length,
					running: 0,
					scheduled: 0,
					queued: 0,
					completed: 0,
					failed: 0,
					repeating: 0,
					paused: 0
				};

				for (const jobId of jobIds) {
					const jobData = await this.redis.hgetall(this.key(`job:${jobId}`));
					if (!jobData || Object.keys(jobData).length === 0) continue;

					const job = this.hashToJob(jobData);
					const state = computeJobState(job, now);
					overview[state as keyof typeof overview]++;
					if (job.disabled === true) {
						overview.paused++;
					}
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

	async removeJobs(options: RemoveJobsOptions): Promise<number> {
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

	/**
	 * Get job IDs matching the given options
	 */
	private async getJobIdsFromOptions(options: RemoveJobsOptions): Promise<string[]> {
		if (options.id) {
			return [options.id.toString()];
		}
		if (options.ids && options.ids.length > 0) {
			return options.ids.map((id: JobId | string) => id.toString());
		}
		if (options.name) {
			return this.redis.smembers(this.key(`jobs:by_name:${options.name}`));
		}
		if (options.names && options.names.length > 0) {
			const sets = options.names.map((n: string) => this.key(`jobs:by_name:${n}`));
			return this.redis.sunion(...sets);
		}
		if (options.notNames && options.notNames.length > 0) {
			const allIds = await this.redis.smembers(this.key('jobs:all'));
			const excludeSets = options.notNames.map((n: string) => this.key(`jobs:by_name:${n}`));
			const excludeIds = new Set(await this.redis.sunion(...excludeSets));
			return allIds.filter((id: string) => !excludeIds.has(id));
		}
		if (options.data !== undefined) {
			// Need to scan all jobs for data match
			const allIds = await this.redis.smembers(this.key('jobs:all'));
			const searchDataStr = JSON.stringify(options.data);
			const matchingIds: string[] = [];
			for (const jobId of allIds) {
				const jobData = await this.redis.hget(this.key(`job:${jobId}`), 'data');
				if (jobData && jobData.includes(searchDataStr.slice(1, -1))) {
					matchingIds.push(jobId);
				}
			}
			return matchingIds;
		}
		// No criteria - return empty array
		return [];
	}

	async disableJobs(options: RemoveJobsOptions): Promise<number> {
		const jobIds = await this.getJobIdsFromOptions(options);
		if (jobIds.length === 0) {
			return 0;
		}

		let modified = 0;
		const now = new Date().toISOString();
		for (const jobId of jobIds) {
			const exists = await this.redis.exists(this.key(`job:${jobId}`));
			if (!exists) continue;

			await this.redis.hset(this.key(`job:${jobId}`), 'disabled', 'true', 'updatedAt', now);
			modified++;
		}

		return modified;
	}

	async enableJobs(options: RemoveJobsOptions): Promise<number> {
		const jobIds = await this.getJobIdsFromOptions(options);
		if (jobIds.length === 0) {
			return 0;
		}

		let modified = 0;
		const now = new Date().toISOString();
		for (const jobId of jobIds) {
			const exists = await this.redis.exists(this.key(`job:${jobId}`));
			if (!exists) continue;

			await this.redis.hset(this.key(`job:${jobId}`), 'disabled', 'false', 'updatedAt', now);
			modified++;
		}

		return modified;
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

	async unlockJob(job: JobParameters): Promise<void> {
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
			await this.redis.hset(this.key(`job:${id}`), 'lockedAt', 'null');
		}
	}

	async lockJob(
		job: JobParameters,
		options: JobRepositoryOptions | undefined
	): Promise<JobParameters | undefined> {
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

	/**
	 * Lua script for atomic find-and-lock operation.
	 * This ensures that only one worker can lock a job, even under concurrent access.
	 *
	 * Arguments:
	 * KEYS[1] = jobs:by_name:{jobName} set
	 * KEYS[2] = jobs:by_next_run_at sorted set
	 * KEYS[3] = job:{id} hash prefix (without the id)
	 * ARGV[1] = nextScanAt timestamp (ms)
	 * ARGV[2] = lockDeadline timestamp (ms)
	 * ARGV[3] = lockTime ISO string
	 * ARGV[4] = lastModifiedBy
	 * ARGV[5] = sort direction ('asc' or 'desc')
	 *
	 * Returns: job ID if locked, nil if no job available
	 */
	private static readonly FIND_AND_LOCK_SCRIPT = `
		local jobIds = redis.call('SMEMBERS', KEYS[1])
		if #jobIds == 0 then
			return nil
		end

		local nextScanAt = tonumber(ARGV[1])
		local lockDeadline = tonumber(ARGV[2])
		local lockTime = ARGV[3]
		local lastModifiedBy = ARGV[4]
		local sortDir = ARGV[5]
		local keyPrefix = KEYS[3]

		-- Get scores and sort candidates
		local candidates = {}
		for _, jobId in ipairs(jobIds) do
			local score = redis.call('ZSCORE', KEYS[2], jobId)
			if score then
				table.insert(candidates, {id = jobId, score = tonumber(score)})
			end
		end

		-- Sort by score
		if sortDir == 'asc' then
			table.sort(candidates, function(a, b) return a.score < b.score end)
		else
			table.sort(candidates, function(a, b) return a.score > b.score end)
		end

		-- Try to lock each candidate
		for _, candidate in ipairs(candidates) do
			local jobKey = keyPrefix .. candidate.id
			local jobData = redis.call('HGETALL', jobKey)

			if #jobData > 0 then
				-- Convert array to table
				local data = {}
				for i = 1, #jobData, 2 do
					data[jobData[i]] = jobData[i + 1]
				end

				-- Check if disabled
				if data.disabled ~= 'true' then
					local lockedAt = data.lockedAt
					local nextRunAt = data.nextRunAt
					local lockedAtMs = data.lockedAtMs

					-- Check if job is ready to run
					local isUnlockedAndReady = false
					local isStale = false

					if lockedAt == 'null' or lockedAt == nil then
						-- Job is unlocked
						if nextRunAt and nextRunAt ~= 'null' then
							-- We compare scores since they're based on nextRunAt
							if candidate.score <= nextScanAt then
								isUnlockedAndReady = true
							end
						end
					else
						-- Job is locked - check if stale using lockedAtMs field
						if lockedAtMs and lockedAtMs ~= 'null' then
							local lockedAtTime = tonumber(lockedAtMs)
							if lockedAtTime and lockedAtTime <= lockDeadline then
								isStale = true
							end
						end
					end

					if isUnlockedAndReady or isStale then
						-- Lock the job atomically, also store lockedAtMs for efficient stale checks
						local lockTimeMs = redis.call('TIME')
						local lockTimestamp = (lockTimeMs[1] * 1000) + math.floor(lockTimeMs[2] / 1000)
						redis.call('HSET', jobKey, 'lockedAt', lockTime, 'lockedAtMs', tostring(lockTimestamp), 'lastModifiedBy', lastModifiedBy, 'updatedAt', lockTime)
						return candidate.id
					end
				end
			end
		end

		return nil
	`;

	async getNextJobToRun(
		jobName: string,
		nextScanAt: Date,
		lockDeadline: Date,
		now: Date | undefined,
		options: JobRepositoryOptions | undefined
	): Promise<JobParameters | undefined> {
		const lockTime = now ?? new Date();

		// Use Lua script for atomic find-and-lock
		const result = await this.redis.eval(
			RedisJobRepository.FIND_AND_LOCK_SCRIPT,
			3, // number of keys
			this.key(`jobs:by_name:${jobName}`),
			this.key('jobs:by_next_run_at'),
			this.key('job:'),
			nextScanAt.getTime().toString(),
			lockDeadline.getTime().toString(),
			lockTime.toISOString(),
			options?.lastModifiedBy ?? 'null',
			this.sort.nextRunAt || 'asc'
		) as string | null;

		if (!result) {
			return undefined;
		}

		// Fetch the locked job
		const jobData = await this.redis.hgetall(this.key(`job:${result}`));
		if (!jobData || Object.keys(jobData).length === 0) {
			return undefined;
		}

		return this.hashToJob(jobData);
	}

	async saveJobState(
		job: JobParameters,
		options: JobRepositoryOptions | undefined
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
			fork: String(job.fork ?? false),
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
		job: JobParameters<DATA>,
		options: JobRepositoryOptions | undefined
	): Promise<JobParameters<DATA>> {
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

			// Update the job - only update scheduling/config fields, not execution state fields
			// Execution state (lockedAt, lastRunAt, lastFinishedAt, failedAt, failCount, failReason, progress)
			// should only be updated via saveJobState
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
				fork: String(props.fork ?? false),
				lastModifiedBy: options?.lastModifiedBy ?? 'null',
				updatedAt: now
			};

			// Only update fail-related fields if they were explicitly set (for job.fail().save() pattern)
			if (props.failReason !== undefined) {
				updates.failReason = props.failReason ?? 'null';
			}
			if (props.failedAt !== undefined) {
				updates.failedAt = props.failedAt?.toISOString() || 'null';
			}
			if (props.failCount !== undefined) {
				updates.failCount = String(props.failCount);
			}

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
			const hashData = this.jobToHash(props as JobParameters<DATA>, newId, options?.lastModifiedBy);

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

			const debounce = uniqueOpts?.debounce;
			const now = new Date();
			const nowIso = now.toISOString();

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
					if (uniqueOpts?.insertOnly && !debounce) {
						return this.hashToJob<DATA>(jobData);
					}

					// Determine nextRunAt and debounceStartedAt for update
					let nextRunAt: string = props.nextRunAt?.toISOString() || 'null';
					let debounceStartedAt: string = 'null';

					if (debounce) {
						log('handling debounce with delay: %dms, strategy: %s', debounce.delay, debounce.strategy || 'trailing');

						const existingDebounceStartedAt = jobData.debounceStartedAt && jobData.debounceStartedAt !== 'null'
							? new Date(jobData.debounceStartedAt)
							: now;
						const timeSinceStart = now.getTime() - existingDebounceStartedAt.getTime();

						if (debounce.strategy === 'leading') {
							// Leading: keep original nextRunAt, just update data
							log('leading debounce: keeping original nextRunAt, updating data only');
							nextRunAt = jobData.nextRunAt || 'null';
							debounceStartedAt = existingDebounceStartedAt.toISOString();
						} else {
							// Trailing (default): push nextRunAt forward
							if (debounce.maxWait && timeSinceStart >= debounce.maxWait) {
								log('maxWait exceeded (%dms >= %dms), forcing immediate execution', timeSinceStart, debounce.maxWait);
								nextRunAt = nowIso;
								debounceStartedAt = 'null'; // Reset for next cycle
							} else {
								const newNextRunAt = new Date(now.getTime() + debounce.delay);
								nextRunAt = newNextRunAt.toISOString();
								debounceStartedAt = existingDebounceStartedAt.toISOString();
								log('trailing debounce: rescheduling to %s', nextRunAt);
							}
						}
					}

					// Update existing job
					const updates: Record<string, string> = {
						priority: String(props.priority ?? 0),
						nextRunAt,
						type: props.type || 'normal',
						repeatTimezone: props.repeatTimezone ?? 'null',
						repeatInterval: props.repeatInterval !== undefined ? String(props.repeatInterval) : 'null',
						data: JSON.stringify(props.data ?? {}),
						repeatAt: props.repeatAt ?? 'null',
						disabled: String(props.disabled ?? false),
						lastModifiedBy: options?.lastModifiedBy ?? 'null',
						debounceStartedAt,
						updatedAt: nowIso
					};

					await this.redis.hset(this.key(`job:${jobId}`), updates);

					const parsedNextRunAt = nextRunAt !== 'null' ? new Date(nextRunAt) : null;
					const score = this.getJobScore(parsedNextRunAt, props.priority ?? 0);
					await this.redis.zadd(this.key('jobs:by_next_run_at'), score, jobId);

					const updatedData = await this.redis.hgetall(this.key(`job:${jobId}`));
					return this.hashToJob<DATA>(updatedData);
				}
			}

			// No existing record - insert new job with debounce handling
			if (debounce) {
				let nextRunAt: Date | null = props.nextRunAt || null;
				const debounceStartedAt: Date = now;

				if (debounce.strategy === 'leading') {
					// Leading: execute immediately (keep nextRunAt as-is)
					log('leading debounce: new job, executing immediately');
				} else {
					// Trailing: schedule after delay
					nextRunAt = new Date(now.getTime() + debounce.delay);
					log('trailing debounce: new job, scheduling for %s', nextRunAt.toISOString());
				}

				const newId = randomUUID();
				const jobWithDebounce = {
					...props,
					nextRunAt,
					debounceStartedAt
				} as JobParameters<DATA>;
				const hashData = this.jobToHash(jobWithDebounce, newId, options?.lastModifiedBy);

				await this.redis.hset(this.key(`job:${newId}`), hashData as unknown as Record<string, string>);
				await this.redis.sadd(this.key('jobs:all'), newId);
				await this.redis.sadd(this.key(`jobs:by_name:${props.name}`), newId);

				const score = this.getJobScore(nextRunAt, props.priority ?? 0);
				await this.redis.zadd(this.key('jobs:by_next_run_at'), score, newId);

				const savedData = await this.redis.hgetall(this.key(`job:${newId}`));
				return this.hashToJob<DATA>(savedData);
			}
		}

		// Insert new job
		log('inserting new job');
		const newId = randomUUID();
		const hashData = this.jobToHash(props as JobParameters<DATA>, newId, options?.lastModifiedBy);

		await this.redis.hset(this.key(`job:${newId}`), hashData as unknown as Record<string, string>);
		await this.redis.sadd(this.key('jobs:all'), newId);
		await this.redis.sadd(this.key(`jobs:by_name:${props.name}`), newId);

		const score = this.getJobScore(props.nextRunAt ?? null, props.priority ?? 0);
		await this.redis.zadd(this.key('jobs:by_next_run_at'), score, newId);

		const savedData = await this.redis.hgetall(this.key(`job:${newId}`));
		return this.hashToJob<DATA>(savedData);
	}
}
