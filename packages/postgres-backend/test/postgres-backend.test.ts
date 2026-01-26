import { expect, describe, it, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import {
	PostgresBackend,
	PostgresJobRepository,
	PostgresNotificationChannel,
	getDropTableSQL
} from '../src/index.js';
import { fullAgendaTestSuite } from 'agenda/testing';

/**
 * PostgreSQL backend tests.
 *
 * The test setup (setup.ts) automatically:
 * 1. Checks for POSTGRES_TEST_URL environment variable
 * 2. If not set, attempts to start a Docker container
 * 3. Throws an error if no PostgreSQL is available (tests will fail)
 */

const TEST_TABLE_NAME = 'agenda_jobs_test';
const TEST_CHANNEL_NAME = 'agenda_jobs_test';

// Connection string is set by the global setup
const getConnectionString = () => process.env.POSTGRES_TEST_URL!;

// Store connection string for fork helper
let sharedConnectionString: string;

// ============================================================================
// Shared Database Connection
// ============================================================================

let sharedPool: Pool;

beforeAll(async () => {
	sharedConnectionString = getConnectionString();
	sharedPool = new Pool({ connectionString: sharedConnectionString });
	await sharedPool.query(getDropTableSQL(TEST_TABLE_NAME));
});

afterAll(async () => {
	await sharedPool.query(getDropTableSQL(TEST_TABLE_NAME));
	await sharedPool.end();
});

// ============================================================================
// Full Agenda Test Suite
// ============================================================================

fullAgendaTestSuite({
	name: 'PostgresBackend',
	createBackend: async () => {
		const backend = new PostgresBackend({
			connectionString: sharedConnectionString,
			tableName: TEST_TABLE_NAME,
			channelName: TEST_CHANNEL_NAME,
			// Disable notification channel for tests - causes hangs
			disableNotifications: true
		});
		await backend.connect();
		return backend;
	},
	cleanupBackend: async backend => {
		await backend.disconnect();
	},
	clearJobs: async () => {
		await sharedPool.query(`DELETE FROM "${TEST_TABLE_NAME}"`);
	},
	// Fork mode configuration - env is evaluated at test time via getter
	forkHelper: {
		path: './test/helpers/forkHelper.ts',
		options: {
			execArgv: ['--import', 'tsx'],
			get env() {
				return {
					...process.env,
					DB_CONNECTION: sharedConnectionString,
					DB_TABLE: TEST_TABLE_NAME
				};
			}
		}
	}
});

// ============================================================================
// PostgreSQL-Specific Tests
// ============================================================================

describe('PostgresBackend', () => {
	let pool: Pool;
	let backend: PostgresBackend;

	beforeAll(async () => {
		pool = new Pool({ connectionString: getConnectionString() });
		await pool.query(getDropTableSQL(TEST_TABLE_NAME));
	});

	afterAll(async () => {
		await pool.query(getDropTableSQL(TEST_TABLE_NAME));
		await pool.end();
	});

	beforeEach(async () => {
		backend = new PostgresBackend({
			connectionString: getConnectionString(),
			tableName: TEST_TABLE_NAME,
			channelName: TEST_CHANNEL_NAME
		});
		await backend.connect();
	});

	afterEach(async () => {
		await backend.disconnect();
		const cleanPool = new Pool({ connectionString: getConnectionString() });
		await cleanPool.query(`DELETE FROM "${TEST_TABLE_NAME}"`);
		await cleanPool.end();
	});

	describe('backend interface', () => {
		it('should connect and create schema', async () => {
			const result = await pool.query(
				`SELECT EXISTS (
					SELECT FROM information_schema.tables
					WHERE table_name = $1
				)`,
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

	describe('existing pool support', () => {
		it('should accept an existing pool', async () => {
			const existingPool = new Pool({ connectionString: getConnectionString() });

			const backendWithPool = new PostgresBackend({
				pool: existingPool,
				tableName: TEST_TABLE_NAME + '_pool',
				channelName: TEST_CHANNEL_NAME
			});

			await backendWithPool.connect();
			expect(backendWithPool.repository).toBeDefined();

			// Save and retrieve a job
			const saved = await backendWithPool.repository.saveJob({
				name: 'pool-test',
				priority: 0,
				nextRunAt: new Date(),
				type: 'normal',
				data: {}
			}, undefined);
			expect(saved._id).toBeDefined();

			await backendWithPool.disconnect();

			// Pool should still be usable after disconnect
			const result = await existingPool.query('SELECT 1');
			expect(result.rows[0]).toBeDefined();

			// Cleanup
			await existingPool.query(getDropTableSQL(TEST_TABLE_NAME + '_pool'));
			await existingPool.end();
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
			}, undefined);

			const result = await backend.repository.queryJobs({
				data: { nested: { key: 'value' } }
			});

			expect(result.total).toBe(1);
			expect(result.jobs[0].data).toEqual({ nested: { key: 'value' }, array: [1, 2, 3] });
		});

		it('should handle concurrent job locking with SKIP LOCKED', async () => {
			await Promise.all([
				backend.repository.saveJob({
					name: 'concurrent-test',
					priority: 0,
					nextRunAt: new Date(Date.now() - 1000),
					type: 'normal',
					data: { id: 1 }
				}, undefined),
				backend.repository.saveJob({
					name: 'concurrent-test',
					priority: 0,
					nextRunAt: new Date(Date.now() - 1000),
					type: 'normal',
					data: { id: 2 }
				}, undefined)
			]);

			const now = new Date();
			const nextScanAt = new Date(now.getTime() + 5000);
			const lockDeadline = new Date(now.getTime() - 600000);

			const [next1, next2] = await Promise.all([
				backend.repository.getNextJobToRun('concurrent-test', nextScanAt, lockDeadline, now, undefined),
				backend.repository.getNextJobToRun('concurrent-test', nextScanAt, lockDeadline, now, undefined)
			]);

			expect(next1).toBeDefined();
			expect(next2).toBeDefined();
			expect(next1!._id).not.toBe(next2!._id);
		});

		it('should use indexes for efficient queries', async () => {
			const result = await pool.query(
				`SELECT indexname FROM pg_indexes WHERE tablename = $1`,
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
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		expect(() => new PostgresBackend({} as any)).toThrow(
			'PostgresBackend requires pool, connectionString, or poolConfig'
		);
	});

	it('should accept connectionString config', () => {
		const backend = new PostgresBackend({
			connectionString: 'postgresql://localhost/test'
		});
		expect(backend.repository).toBeDefined();
		expect(backend.notificationChannel).toBeDefined();
	});
});
