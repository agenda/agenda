import type { Redis, RedisOptions } from 'ioredis';

/**
 * Configuration options for RedisBackend
 */
export interface IRedisBackendConfig {
	/** Redis connection URL (e.g., 'redis://localhost:6379') */
	connectionString?: string;

	/** Redis client options (creates a new client) */
	redisOptions?: RedisOptions;

	/** Existing Redis client instance (will not be closed on disconnect) */
	redis?: Redis;

	/** Key prefix for all Redis keys (default: 'agenda:') */
	keyPrefix?: string;

	/** Channel name for Pub/Sub notifications (default: 'agenda:notifications') */
	channelName?: string;

	/** Sort order for job queries (default: { nextRunAt: 1, priority: -1 }) */
	sort?: {
		nextRunAt?: 1 | -1;
		priority?: 1 | -1;
	};
}

/**
 * Internal job storage type for Redis
 * All fields are stored as strings in Redis hashes
 */
export interface IRedisJobData {
	id: string;
	name: string;
	priority: string;
	nextRunAt: string | null;
	type: 'normal' | 'single';
	lockedAt: string | null;
	lastFinishedAt: string | null;
	failedAt: string | null;
	failCount: string | null;
	failReason: string | null;
	repeatTimezone: string | null;
	lastRunAt: string | null;
	repeatInterval: string | null;
	data: string;
	repeatAt: string | null;
	disabled: string;
	progress: string | null;
	lastModifiedBy: string | null;
	createdAt: string;
	updatedAt: string;
}
