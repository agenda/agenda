import { expect, describe, it, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import Redis from 'ioredis';
import {
	RedisBackend,
	RedisJobRepository,
	RedisNotificationChannel,
	RedisJobLogger
} from '../src/index.js';
import { fullAgendaTestSuite, jobLoggerTestSuite } from 'agenda/testing';

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

// Store connection string for fork helper
let sharedConnectionString: string;

// Helper to clear all test keys
async function clearTestKeys(redis: Redis): Promise<void> {
	const keys = await redis.keys(`${TEST_KEY_PREFIX}*`);
	if (keys.length > 0) {
		await redis.del(...keys);
	}
}

// ============================================================================
// Shared Redis Connection
// ============================================================================

let sharedRedis: Redis;

beforeAll(async () => {
	sharedConnectionString = getConnectionString();
	sharedRedis = new Redis(sharedConnectionString);
	await clearTestKeys(sharedRedis);
});

afterAll(async () => {
	await clearTestKeys(sharedRedis);
	sharedRedis.disconnect();
});

// ============================================================================
// Full Agenda Test Suite
// ============================================================================

fullAgendaTestSuite({
	name: 'RedisBackend',
	createBackend: async () => {
		const backend = new RedisBackend({
			// Pass the shared redis client so ownsConnection is false
			// This allows stop() to not close the client, so tests can query after stop
			redis: sharedRedis,
			keyPrefix: TEST_KEY_PREFIX,
			channelName: TEST_CHANNEL_NAME
		});
		await backend.connect();
		return backend;
	},
	cleanupBackend: async backend => {
		await backend.disconnect();
	},
	clearJobs: async () => {
		await clearTestKeys(sharedRedis);
	},
	// Fork mode configuration - env is evaluated at test time via getter
	forkHelper: {
		path: './test/helpers/forkHelper.ts',
		options: {
			execArgv: ['--import', 'tsx'],
			get env() {
				return {
					...process.env,
					REDIS_CONNECTION: sharedConnectionString,
					REDIS_KEY_PREFIX: TEST_KEY_PREFIX
				};
			}
		}
	}
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

		it('should report ownsConnection correctly', () => {
			// This backend was created with connectionString, so it owns the connection
			expect(backend.ownsConnection).toBe(true);

			// Create one with existing client
			const backendWithClient = new RedisBackend({
				redis: redis,
				keyPrefix: TEST_KEY_PREFIX
			});
			expect(backendWithClient.ownsConnection).toBe(false);
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

		it('should handle sequential job locking correctly', async () => {
			await Promise.all([
				backend.repository.saveJob({
					name: 'lock-test',
					priority: 0,
					nextRunAt: new Date(Date.now() - 1000),
					type: 'normal',
					data: { id: 1 }
				}),
				backend.repository.saveJob({
					name: 'lock-test',
					priority: 0,
					nextRunAt: new Date(Date.now() - 1000),
					type: 'normal',
					data: { id: 2 }
				})
			]);

			const now = new Date();
			const nextScanAt = new Date(now.getTime() + 5000);
			const lockDeadline = new Date(now.getTime() - 600000);

			// Sequential calls should lock different jobs
			const next1 = await backend.repository.getNextJobToRun('lock-test', nextScanAt, lockDeadline, now);
			const next2 = await backend.repository.getNextJobToRun('lock-test', nextScanAt, lockDeadline, now);

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

// ============================================================================
// RedisJobLogger Tests (shared test suite)
// ============================================================================

const TEST_LOG_PREFIX = 'agenda_test_log:';

jobLoggerTestSuite({
	name: 'RedisJobLogger',
	createLogger: async () => {
		const logger = new RedisJobLogger({ redis: sharedRedis, keyPrefix: TEST_LOG_PREFIX });
		return logger;
	},
	cleanupLogger: async (logger) => {
		await logger.clearLogs();
	}
});
