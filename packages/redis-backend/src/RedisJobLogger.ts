import debug from 'debug';
import type { Redis } from 'ioredis';
import type { JobLogger, JobLogEntry, JobLogQuery, JobLogQueryResult, LogLevel, JobLogEvent } from 'agenda';

const log = debug('agenda:redis:logger');

/**
 * Redis implementation of JobLogger.
 * Stores job lifecycle events using Redis sorted sets and hashes.
 *
 * Data structure:
 * - `{prefix}log:{id}` - Hash for each log entry
 * - `{prefix}logs:all` - Sorted set of all log IDs (score = timestamp)
 * - `{prefix}logs:by_job:{jobId}` - Sorted set of log IDs per job
 * - `{prefix}logs:by_name:{jobName}` - Sorted set of log IDs per job name
 *
 * @example
 * ```typescript
 * import { RedisBackend } from '@agendajs/redis-backend';
 *
 * const backend = new RedisBackend({
 *   connectionString: 'redis://localhost:6379',
 *   logging: true // enables RedisJobLogger
 * });
 * ```
 */
export class RedisJobLogger implements JobLogger {
	private redis!: Redis;
	private readonly keyPrefix: string;
	private idCounter = 0;

	constructor(keyPrefix = 'agenda:') {
		this.keyPrefix = keyPrefix;
	}

	private key(suffix: string): string {
		return `${this.keyPrefix}${suffix}`;
	}

	/**
	 * Set the Redis client.
	 * Called by RedisBackend after the repository connects.
	 */
	setRedis(redis: Redis): void {
		this.redis = redis;
		log('Redis client set for job logger');
	}

	private generateId(): string {
		return `${Date.now()}-${process.pid}-${++this.idCounter}`;
	}

	async log(entry: Omit<JobLogEntry, '_id'>): Promise<void> {
		if (!this.redis) {
			log('redis not initialized, skipping log entry');
			return;
		}

		const id = this.generateId();
		const score = entry.timestamp.getTime();
		const hashKey = this.key(`log:${id}`);

		const hashData: Record<string, string> = {
			id,
			timestamp: entry.timestamp.toISOString(),
			level: entry.level,
			event: entry.event,
			jobName: entry.jobName,
			message: entry.message
		};
		if (entry.jobId) hashData.jobId = entry.jobId;
		if (entry.duration !== undefined) hashData.duration = String(entry.duration);
		if (entry.error) hashData.error = entry.error;
		if (entry.failCount !== undefined) hashData.failCount = String(entry.failCount);
		if (entry.retryDelay !== undefined) hashData.retryDelay = String(entry.retryDelay);
		if (entry.retryAttempt !== undefined) hashData.retryAttempt = String(entry.retryAttempt);
		if (entry.agendaName) hashData.agendaName = entry.agendaName;
		if (entry.meta) hashData.meta = JSON.stringify(entry.meta);

		const pipeline = this.redis.pipeline();
		pipeline.hset(hashKey, hashData);
		pipeline.zadd(this.key('logs:all'), score, id);
		if (entry.jobId) {
			pipeline.zadd(this.key(`logs:by_job:${entry.jobId}`), score, id);
		}
		pipeline.zadd(this.key(`logs:by_name:${entry.jobName}`), score, id);
		await pipeline.exec();
	}

	async getLogs(query?: JobLogQuery): Promise<JobLogQueryResult> {
		if (!this.redis) {
			return { entries: [], total: 0 };
		}

		// Determine which sorted set to query
		let setKey: string;
		if (query?.jobId) {
			setKey = this.key(`logs:by_job:${query.jobId}`);
		} else if (query?.jobName) {
			setKey = this.key(`logs:by_name:${query.jobName}`);
		} else {
			setKey = this.key('logs:all');
		}

		// Build score range for timestamp filtering
		const minScore = query?.from ? query.from.getTime() : '-inf';
		const maxScore = query?.to ? query.to.getTime() : '+inf';

		// Get all matching IDs (we'll filter in memory for level/event)
		const sortOrder = query?.sort === 'asc' ? 'asc' : 'desc';
		let allIds: string[];
		if (sortOrder === 'desc') {
			allIds = await this.redis.zrevrangebyscore(
				setKey,
				maxScore as string,
				minScore as string
			);
		} else {
			allIds = await this.redis.zrangebyscore(
				setKey,
				minScore as string,
				maxScore as string
			);
		}

		if (allIds.length === 0) {
			return { entries: [], total: 0 };
		}

		// Fetch all hash data for these IDs
		const pipeline = this.redis.pipeline();
		for (const id of allIds) {
			pipeline.hgetall(this.key(`log:${id}`));
		}
		const results = await pipeline.exec();

		// Convert and filter
		let entries: JobLogEntry[] = [];
		if (results) {
			for (const [err, data] of results) {
				if (err || !data || typeof data !== 'object' || Object.keys(data as Record<string, string>).length === 0) continue;
				const hash = data as Record<string, string>;
				const entry = this.hashToEntry(hash);

				// Apply level filter
				if (query?.level) {
					const levels = Array.isArray(query.level) ? query.level : [query.level];
					if (!levels.includes(entry.level)) continue;
				}
				// Apply event filter
				if (query?.event) {
					const events = Array.isArray(query.event) ? query.event : [query.event];
					if (!events.includes(entry.event)) continue;
				}

				entries.push(entry);
			}
		}

		const total = entries.length;
		const offset = query?.offset ?? 0;
		const limit = query?.limit ?? 50;
		entries = entries.slice(offset, offset + limit);

		return { entries, total };
	}

	async clearLogs(query?: JobLogQuery): Promise<number> {
		if (!this.redis) {
			return 0;
		}

		// Get IDs to delete
		const { entries, total } = await this.getLogs({
			...query,
			limit: Number.MAX_SAFE_INTEGER,
			offset: 0
		});

		if (entries.length === 0) return 0;

		const pipeline = this.redis.pipeline();
		for (const entry of entries) {
			if (!entry._id) continue;
			// Remove hash
			pipeline.del(this.key(`log:${entry._id}`));
			// Remove from all sorted sets
			pipeline.zrem(this.key('logs:all'), entry._id);
			if (entry.jobId) {
				pipeline.zrem(this.key(`logs:by_job:${entry.jobId}`), entry._id);
			}
			pipeline.zrem(this.key(`logs:by_name:${entry.jobName}`), entry._id);
		}
		await pipeline.exec();

		return total;
	}

	private hashToEntry(hash: Record<string, string>): JobLogEntry {
		return {
			_id: hash.id,
			timestamp: new Date(hash.timestamp),
			level: hash.level as LogLevel,
			event: hash.event as JobLogEvent,
			jobId: hash.jobId || undefined,
			jobName: hash.jobName,
			message: hash.message,
			duration: hash.duration ? parseInt(hash.duration, 10) : undefined,
			error: hash.error || undefined,
			failCount: hash.failCount ? parseInt(hash.failCount, 10) : undefined,
			retryDelay: hash.retryDelay ? parseInt(hash.retryDelay, 10) : undefined,
			retryAttempt: hash.retryAttempt ? parseInt(hash.retryAttempt, 10) : undefined,
			agendaName: hash.agendaName || undefined,
			meta: hash.meta ? JSON.parse(hash.meta) : undefined
		};
	}
}
