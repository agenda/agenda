import type { Redis, RedisOptions } from 'ioredis';
import type { SortDirection } from 'agenda';

/**
 * Configuration options for RedisBackend
 */
export interface RedisBackendConfig {
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

	/** Sort order for job queries (default: { nextRunAt: 'asc', priority: 'desc' }) */
	sort?: {
		nextRunAt?: SortDirection;
		priority?: SortDirection;
	};
}

/**
 * Internal job storage type for Redis
 * All fields are stored as strings in Redis hashes
 */
export interface RedisJobData {
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
	fork: string;
	lastModifiedBy: string | null;
	createdAt: string;
	updatedAt: string;
}
