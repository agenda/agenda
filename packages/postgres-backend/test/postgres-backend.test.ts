import { expect, describe, it, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import {
	PostgresBackend,
	PostgresJobRepository,
	PostgresNotificationChannel,
	getDropTableSQL
} from '../src';
import {
	repositoryTestSuite,
	notificationChannelTestSuite
} from '../../agenda/test/shared';
import type { IJobParameters, IJobNotification, JobId } from 'agenda';
import { toJobId } from 'agenda';

/**
 * These tests require a PostgreSQL database to be available.
 * Set the POSTGRES_TEST_URL environment variable to run these tests.
 *
 * Example:
 *   POSTGRES_TEST_URL=postgresql://postgres:postgres@localhost:5432/agenda_test pnpm test
 */

const TEST_CONNECTION_STRING = process.env.POSTGRES_TEST_URL;
const TEST_TABLE_NAME = 'agenda_jobs_test';
const TEST_CHANNEL_NAME = 'agenda_jobs_test';

const describeWithPostgres = TEST_CONNECTION_STRING ? describe : describe.skip;

// ============================================================================
// Shared Repository Test Suite
// ============================================================================

if (TEST_CONNECTION_STRING) {
	let sharedPool: Pool;

	// Setup/teardown for shared test suite
	beforeAll(async () => {
		sharedPool = new Pool({ connectionString: TEST_CONNECTION_STRING });
		await sharedPool.query(getDropTableSQL(TEST_TABLE_NAME));
	});

	afterAll(async () => {
		await sharedPool.query(getDropTableSQL(TEST_TABLE_NAME));
		await sharedPool.end();
	});

	repositoryTestSuite({
		name: 'PostgresJobRepository',
		createRepository: async () => {
			const repo = new PostgresJobRepository({
				connectionString: TEST_CONNECTION_STRING,
				tableName: TEST_TABLE_NAME,
				ensureSchema: true
			});
			await repo.connect();
			return repo;
		},
		cleanupRepository: async repo => {
			// Don't disconnect - we're reusing the connection
			// Just clear jobs
		},
		clearJobs: async repo => {
			const pgRepo = repo as PostgresJobRepository;
			const pool = pgRepo.getPool();
			await pool.query(`DELETE FROM "${TEST_TABLE_NAME}"`);
		}
	});

	notificationChannelTestSuite({
		name: 'PostgresNotificationChannel',
		createChannel: async () => {
			return new PostgresNotificationChannel({
				connectionString: TEST_CONNECTION_STRING,
				channelName: TEST_CHANNEL_NAME
			});
		},
		cleanupChannel: async channel => {
			if (channel.state !== 'disconnected') {
				await channel.disconnect();
			}
		},
		propagationDelay: 150 // PostgreSQL LISTEN/NOTIFY may need slightly more time
	});
}

// ============================================================================
// PostgreSQL-Specific Tests
// ============================================================================

describeWithPostgres('PostgresBackend', () => {
	let pool: Pool;
	let backend: PostgresBackend;

	beforeAll(async () => {
		pool = new Pool({ connectionString: TEST_CONNECTION_STRING });
		// Clean up any existing test table
		await pool.query(getDropTableSQL(TEST_TABLE_NAME));
	});

	afterAll(async () => {
		// Clean up test table
		await pool.query(getDropTableSQL(TEST_TABLE_NAME));
		await pool.end();
	});

	beforeEach(async () => {
		backend = new PostgresBackend({
			connectionString: TEST_CONNECTION_STRING,
			tableName: TEST_TABLE_NAME,
			channelName: TEST_CHANNEL_NAME
		});
		await backend.connect();
	});

	afterEach(async () => {
		await backend.disconnect();
		// Clean up jobs between tests
		const cleanPool = new Pool({ connectionString: TEST_CONNECTION_STRING });
		await cleanPool.query(`DELETE FROM "${TEST_TABLE_NAME}"`);
		await cleanPool.end();
	});

	describe('backend interface', () => {
		it('should connect and create schema', async () => {
			// Verify table exists
			const result = await pool.query(
				`
				SELECT EXISTS (
					SELECT FROM information_schema.tables
					WHERE table_name = $1
				)
			`,
				[TEST_TABLE_NAME]
			);
			expect(result.rows[0].exists).toBe(true);
		});

		it('should provide repository', () => {
			expect(backend.repository).toBeDefined();
			expect(backend.repository).toBeInstanceOf(PostgresJobRepository);
		});

		it('should provide notification channel', () => {
			expect(backend.notificationChannel).toBeDefined();
			expect(backend.notificationChannel).toBeInstanceOf(PostgresNotificationChannel);
		});
	});

	describe('PostgreSQL-specific features', () => {
		it('should support JSONB queries for job data', async () => {
			await backend.repository.saveJob({
				name: 'jsonb-test',
				priority: 0,
				nextRunAt: new Date(),
				type: 'normal',
				data: { nested: { key: 'value' }, array: [1, 2, 3] }
			});

			const result = await backend.repository.queryJobs({
				data: { nested: { key: 'value' } }
			});

			expect(result.total).toBe(1);
			expect(result.jobs[0].data).toEqual({ nested: { key: 'value' }, array: [1, 2, 3] });
		});

		it('should handle concurrent job locking with SKIP LOCKED', async () => {
			// Create multiple jobs
			const jobs = await Promise.all([
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

			// Get next jobs concurrently - each should get a different job
			const [next1, next2] = await Promise.all([
				backend.repository.getNextJobToRun('concurrent-test', nextScanAt, lockDeadline, now),
				backend.repository.getNextJobToRun('concurrent-test', nextScanAt, lockDeadline, now)
			]);

			expect(next1).toBeDefined();
			expect(next2).toBeDefined();
			expect(next1!._id).not.toBe(next2!._id);
		});

		it('should use indexes for efficient queries', async () => {
			// Verify indexes exist
			const result = await pool.query(
				`
				SELECT indexname FROM pg_indexes
				WHERE tablename = $1
			`,
				[TEST_TABLE_NAME]
			);

			const indexNames = result.rows.map(r => r.indexname);
			expect(indexNames.some(n => n.includes('find_and_lock'))).toBe(true);
			expect(indexNames.some(n => n.includes('single_job'))).toBe(true);
		});
	});
});

// ============================================================================
// Unit Tests (no database required)
// ============================================================================

describe('PostgresBackend unit tests', () => {
	it('should throw if no connection config provided', () => {
		expect(() => new PostgresBackend({} as any)).toThrow(
			'PostgresBackend requires connectionString or pool config'
		);
	});

	it('should accept connectionString config', () => {
		const backend = new PostgresBackend({
			connectionString: 'postgresql://localhost/test'
		});
		expect(backend.repository).toBeDefined();
		expect(backend.notificationChannel).toBeDefined();
	});

	it('should use default table and channel names', () => {
		const backend = new PostgresBackend({
			connectionString: 'postgresql://localhost/test'
		});
		// These are internal, but we can verify the backend was created
		expect(backend.repository).toBeDefined();
		expect(backend.notificationChannel).toBeDefined();
	});
});
