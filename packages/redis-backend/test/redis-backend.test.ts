import { expect, describe, it, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import Redis from 'ioredis';
import {
	RedisBackend,
	RedisJobRepository,
	RedisNotificationChannel
} from '../src';
import {
	repositoryTestSuite,
	notificationChannelTestSuite
} from '../../agenda/test/shared';

/**
 * Redis backend tests.
 *
 * The test setup (setup.ts) automatically:
 * 1. Checks for REDIS_TEST_URL environment variable
 * 2. If not set, attempts to start a Docker container
 * 3. Throws an error if no Redis is available (tests will fail)
 */

const TEST_KEY_PREFIX = 'agenda_test:';
const TEST_CHANNEL_NAME = 'agenda_test:notifications';

// Connection string is set by the global setup
const getConnectionString = () => process.env.REDIS_TEST_URL!;

// Helper to clear all test keys
async function clearTestKeys(redis: Redis): Promise<void> {
	const keys = await redis.keys(`${TEST_KEY_PREFIX}*`);
	if (keys.length > 0) {
		await redis.del(...keys);
	}
}

// ============================================================================
// Shared Repository Test Suite
// ============================================================================

let sharedRedis: Redis;

beforeAll(async () => {
	sharedRedis = new Redis(getConnectionString());
	await clearTestKeys(sharedRedis);
});

afterAll(async () => {
	await clearTestKeys(sharedRedis);
	sharedRedis.disconnect();
});

repositoryTestSuite({
	name: 'RedisJobRepository',
	createRepository: async () => {
		const repo = new RedisJobRepository({
			connectionString: getConnectionString(),
			keyPrefix: TEST_KEY_PREFIX
		});
		await repo.connect();
		return repo;
	},
	cleanupRepository: async () => {
		// Don't disconnect - we're reusing the connection
	},
	clearJobs: async () => {
		await clearTestKeys(sharedRedis);
	}
});

notificationChannelTestSuite({
	name: 'RedisNotificationChannel',
	createChannel: async () => {
		return new RedisNotificationChannel({
			connectionString: getConnectionString(),
			channelName: TEST_CHANNEL_NAME
		});
	},
	cleanupChannel: async channel => {
		if (channel.state !== 'disconnected') {
			await channel.disconnect();
		}
	},
	propagationDelay: 100 // Redis Pub/Sub is very fast
});

// ============================================================================
// Redis-Specific Tests
// ============================================================================

describe('RedisBackend', () => {
	let redis: Redis;
	let backend: RedisBackend;

	beforeAll(async () => {
		redis = new Redis(getConnectionString());
		await clearTestKeys(redis);
	});

	afterAll(async () => {
		await clearTestKeys(redis);
		redis.disconnect();
	});

	beforeEach(async () => {
		backend = new RedisBackend({
			connectionString: getConnectionString(),
			keyPrefix: TEST_KEY_PREFIX,
			channelName: TEST_CHANNEL_NAME
		});
		await backend.connect();
	});

	afterEach(async () => {
		await backend.disconnect();
		await clearTestKeys(redis);
	});

	describe('backend interface', () => {
		it('should connect successfully', async () => {
			const ping = await redis.ping();
			expect(ping).toBe('PONG');
		});

		it('should provide repository', () => {
			expect(backend.repository).toBeDefined();
			expect(backend.repository).toBeInstanceOf(RedisJobRepository);
		});

		it('should provide notification channel', () => {
			expect(backend.notificationChannel).toBeDefined();
			expect(backend.notificationChannel).toBeInstanceOf(RedisNotificationChannel);
		});
	});

	describe('existing client support', () => {
		it('should accept an existing Redis client', async () => {
			const existingRedis = new Redis(getConnectionString());

			const backendWithClient = new RedisBackend({
				redis: existingRedis,
				keyPrefix: TEST_KEY_PREFIX + 'client_',
				channelName: TEST_CHANNEL_NAME
			});

			await backendWithClient.connect();
			expect(backendWithClient.repository).toBeDefined();

			// Save and retrieve a job
			const saved = await backendWithClient.repository.saveJob({
				name: 'client-test',
				priority: 0,
				nextRunAt: new Date(),
				type: 'normal',
				data: {}
			});
			expect(saved._id).toBeDefined();

			await backendWithClient.disconnect();

			// Redis client should still be usable after disconnect
			const ping = await existingRedis.ping();
			expect(ping).toBe('PONG');

			// Cleanup
			const keys = await existingRedis.keys(`${TEST_KEY_PREFIX}client_*`);
			if (keys.length > 0) {
				await existingRedis.del(...keys);
			}
			existingRedis.disconnect();
		});
	});

	describe('Redis-specific features', () => {
		it('should use sorted sets for job ordering', async () => {
			const now = Date.now();

			await backend.repository.saveJob({
				name: 'sorted-test',
				priority: 5,
				nextRunAt: new Date(now + 60000),
				type: 'normal',
				data: { order: 'later' }
			});

			await backend.repository.saveJob({
				name: 'sorted-test',
				priority: 10,
				nextRunAt: new Date(now + 30000),
				type: 'normal',
				data: { order: 'sooner' }
			});

			// Check sorted set has entries
			const count = await redis.zcard(`${TEST_KEY_PREFIX}jobs:by_next_run_at`);
			expect(count).toBe(2);
		});

		it('should handle concurrent job locking with WATCH', async () => {
			await Promise.all([
				backend.repository.saveJob({
					name: 'concurrent-test',
					priority: 0,
					nextRunAt: new Date(Date.now() - 1000),
					type: 'normal',
					data: { id: 1 }
				}),
				backend.repository.saveJob({
					name: 'concurrent-test',
					priority: 0,
					nextRunAt: new Date(Date.now() - 1000),
					type: 'normal',
					data: { id: 2 }
				})
			]);

			const now = new Date();
			const nextScanAt = new Date(now.getTime() + 5000);
			const lockDeadline = new Date(now.getTime() - 600000);

			const [next1, next2] = await Promise.all([
				backend.repository.getNextJobToRun('concurrent-test', nextScanAt, lockDeadline, now),
				backend.repository.getNextJobToRun('concurrent-test', nextScanAt, lockDeadline, now)
			]);

			expect(next1).toBeDefined();
			expect(next2).toBeDefined();
			expect(next1!._id).not.toBe(next2!._id);
		});

		it('should store job data in Redis hashes', async () => {
			const saved = await backend.repository.saveJob({
				name: 'hash-test',
				priority: 5,
				nextRunAt: new Date(),
				type: 'normal',
				data: { key: 'value' }
			});

			const hashData = await redis.hgetall(`${TEST_KEY_PREFIX}job:${saved._id}`);

			expect(hashData.name).toBe('hash-test');
			expect(hashData.priority).toBe('5');
			expect(hashData.data).toBe(JSON.stringify({ key: 'value' }));
		});

		it('should track jobs by name in sets', async () => {
			await backend.repository.saveJob({
				name: 'set-test',
				priority: 0,
				nextRunAt: new Date(),
				type: 'normal',
				data: {}
			});

			const members = await redis.smembers(`${TEST_KEY_PREFIX}jobs:by_name:set-test`);
			expect(members.length).toBe(1);
		});
	});
});

// ============================================================================
// Unit Tests (no database required)
// ============================================================================

describe('RedisBackend unit tests', () => {
	it('should throw if no connection config provided', () => {
		expect(() => new RedisBackend({} as any)).toThrow(
			'RedisBackend requires redis, connectionString, or redisOptions'
		);
	});

	it('should accept connectionString config', () => {
		const backend = new RedisBackend({
			connectionString: 'redis://localhost:6379'
		});
		expect(backend.repository).toBeDefined();
		expect(backend.notificationChannel).toBeDefined();
	});
});
