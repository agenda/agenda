import { expect, describe, it, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { PostgresBackend, PostgresJobRepository, PostgresNotificationChannel, getDropTableSQL } from '../src';
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
		await pool.query(`DELETE FROM "${TEST_TABLE_NAME}"`);
	});

	describe('connection', () => {
		it('should connect and create schema', async () => {
			// Verify table exists
			const result = await pool.query(`
				SELECT EXISTS (
					SELECT FROM information_schema.tables
					WHERE table_name = $1
				)
			`, [TEST_TABLE_NAME]);
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

	describe('repository operations', () => {
		it('should save and retrieve a job', async () => {
			const job: IJobParameters = {
				name: 'test-job',
				priority: 10,
				nextRunAt: new Date(),
				type: 'normal',
				data: { foo: 'bar' }
			};

			const saved = await backend.repository.saveJob(job);
			expect(saved._id).toBeDefined();
			expect(saved.name).toBe('test-job');
			expect(saved.priority).toBe(10);
			expect(saved.data).toEqual({ foo: 'bar' });

			// Retrieve by ID
			const retrieved = await backend.repository.getJobById(saved._id!.toString());
			expect(retrieved).not.toBeNull();
			expect(retrieved!.name).toBe('test-job');
		});

		it('should update an existing job', async () => {
			const job: IJobParameters = {
				name: 'update-test',
				priority: 5,
				nextRunAt: new Date(),
				type: 'normal',
				data: { version: 1 }
			};

			const saved = await backend.repository.saveJob(job);

			// Update the job
			const updated = await backend.repository.saveJob({
				...saved,
				priority: 20,
				data: { version: 2 }
			});

			expect(updated._id).toBe(saved._id);
			expect(updated.priority).toBe(20);
			expect(updated.data).toEqual({ version: 2 });
		});

		it('should handle single type jobs (upsert)', async () => {
			const job1: IJobParameters = {
				name: 'single-job',
				priority: 5,
				nextRunAt: new Date(Date.now() + 60000),
				type: 'single',
				data: { run: 1 }
			};

			const saved1 = await backend.repository.saveJob(job1);

			// Save again with same name - should update
			const job2: IJobParameters = {
				name: 'single-job',
				priority: 10,
				nextRunAt: new Date(Date.now() + 120000),
				type: 'single',
				data: { run: 2 }
			};

			const saved2 = await backend.repository.saveJob(job2);

			// Should be same job, updated
			expect(saved2._id).toBe(saved1._id);
			expect(saved2.priority).toBe(10);
			expect(saved2.data).toEqual({ run: 2 });

			// Verify only one job exists
			const result = await backend.repository.queryJobs({ name: 'single-job' });
			expect(result.total).toBe(1);
		});

		it('should remove jobs by name', async () => {
			await backend.repository.saveJob({
				name: 'remove-test',
				priority: 0,
				nextRunAt: new Date(),
				type: 'normal',
				data: {}
			});
			await backend.repository.saveJob({
				name: 'remove-test',
				priority: 0,
				nextRunAt: new Date(),
				type: 'normal',
				data: {}
			});
			await backend.repository.saveJob({
				name: 'keep-test',
				priority: 0,
				nextRunAt: new Date(),
				type: 'normal',
				data: {}
			});

			const removed = await backend.repository.removeJobs({ name: 'remove-test' });
			expect(removed).toBe(2);

			const remaining = await backend.repository.queryJobs();
			expect(remaining.total).toBe(1);
			expect(remaining.jobs[0].name).toBe('keep-test');
		});

		it('should query jobs with filters', async () => {
			await backend.repository.saveJob({
				name: 'job-a',
				priority: 10,
				nextRunAt: new Date(Date.now() + 60000),
				type: 'normal',
				data: { type: 'alpha' }
			});
			await backend.repository.saveJob({
				name: 'job-b',
				priority: 5,
				nextRunAt: new Date(Date.now() + 120000),
				type: 'normal',
				data: { type: 'beta' }
			});

			// Query by name
			const byName = await backend.repository.queryJobs({ name: 'job-a' });
			expect(byName.total).toBe(1);
			expect(byName.jobs[0].name).toBe('job-a');

			// Query by search
			const bySearch = await backend.repository.queryJobs({ search: 'job' });
			expect(bySearch.total).toBe(2);

			// Query by data
			const byData = await backend.repository.queryJobs({ data: { type: 'beta' } });
			expect(byData.total).toBe(1);
			expect(byData.jobs[0].name).toBe('job-b');
		});

		it('should get distinct job names', async () => {
			await backend.repository.saveJob({
				name: 'name-a',
				priority: 0,
				nextRunAt: new Date(),
				type: 'normal',
				data: {}
			});
			await backend.repository.saveJob({
				name: 'name-b',
				priority: 0,
				nextRunAt: new Date(),
				type: 'normal',
				data: {}
			});
			await backend.repository.saveJob({
				name: 'name-a',
				priority: 0,
				nextRunAt: new Date(),
				type: 'normal',
				data: {}
			});

			const names = await backend.repository.getDistinctJobNames();
			expect(names).toEqual(['name-a', 'name-b']);
		});

		it('should get queue size', async () => {
			// Jobs in the past (should be counted)
			await backend.repository.saveJob({
				name: 'past-job',
				priority: 0,
				nextRunAt: new Date(Date.now() - 60000),
				type: 'normal',
				data: {}
			});
			await backend.repository.saveJob({
				name: 'past-job-2',
				priority: 0,
				nextRunAt: new Date(Date.now() - 30000),
				type: 'normal',
				data: {}
			});
			// Job in the future (should not be counted)
			await backend.repository.saveJob({
				name: 'future-job',
				priority: 0,
				nextRunAt: new Date(Date.now() + 60000),
				type: 'normal',
				data: {}
			});

			const queueSize = await backend.repository.getQueueSize();
			expect(queueSize).toBe(2);
		});

		it('should lock and unlock jobs', async () => {
			const saved = await backend.repository.saveJob({
				name: 'lock-test',
				priority: 0,
				nextRunAt: new Date(Date.now() - 1000),
				type: 'normal',
				data: {}
			});

			// Lock the job
			const locked = await backend.repository.lockJob(saved);
			expect(locked).toBeDefined();
			expect(locked!.lockedAt).toBeDefined();

			// Try to lock again - should fail
			const lockedAgain = await backend.repository.lockJob(saved);
			expect(lockedAgain).toBeUndefined();

			// Unlock
			await backend.repository.unlockJob(locked!);

			// Verify unlocked
			const retrieved = await backend.repository.getJobById(saved._id!.toString());
			expect(retrieved!.lockedAt).toBeUndefined();
		});

		it('should get next job to run', async () => {
			// Create jobs with different priorities
			await backend.repository.saveJob({
				name: 'runner-test',
				priority: 5,
				nextRunAt: new Date(Date.now() - 60000),
				type: 'normal',
				data: { order: 'low' }
			});
			await backend.repository.saveJob({
				name: 'runner-test',
				priority: 10,
				nextRunAt: new Date(Date.now() - 30000),
				type: 'normal',
				data: { order: 'high' }
			});

			const now = new Date();
			const nextScanAt = new Date(now.getTime() + 5000);
			const lockDeadline = new Date(now.getTime() - 600000);

			// Should get highest priority job first
			const next = await backend.repository.getNextJobToRun('runner-test', nextScanAt, lockDeadline, now);
			expect(next).toBeDefined();
			expect(next!.priority).toBe(10);
			expect(next!.data).toEqual({ order: 'high' });
		});

		it('should save job state', async () => {
			const saved = await backend.repository.saveJob({
				name: 'state-test',
				priority: 0,
				nextRunAt: new Date(),
				type: 'normal',
				data: {}
			});

			const now = new Date();
			await backend.repository.saveJobState({
				...saved,
				lastRunAt: now,
				lastFinishedAt: now,
				progress: 50,
				failCount: 1,
				failReason: 'Test error'
			});

			const retrieved = await backend.repository.getJobById(saved._id!.toString());
			expect(retrieved!.lastRunAt).toBeDefined();
			expect(retrieved!.lastFinishedAt).toBeDefined();
			expect(retrieved!.progress).toBe(50);
			expect(retrieved!.failCount).toBe(1);
			expect(retrieved!.failReason).toBe('Test error');
		});
	});
});

describeWithPostgres('PostgresNotificationChannel', () => {
	let channel: PostgresNotificationChannel;

	beforeEach(async () => {
		channel = new PostgresNotificationChannel({
			connectionString: TEST_CONNECTION_STRING,
			channelName: TEST_CHANNEL_NAME
		});
		await channel.connect();
	});

	afterEach(async () => {
		await channel.disconnect();
	});

	it('should connect and set state', async () => {
		expect(channel.state).toBe('connected');
	});

	it('should publish and receive notifications', async () => {
		const received: IJobNotification[] = [];

		channel.subscribe(notification => {
			received.push(notification);
		});

		const notification: IJobNotification = {
			jobId: toJobId('test-id-123') as JobId,
			jobName: 'test-job',
			nextRunAt: new Date(),
			priority: 10,
			timestamp: new Date()
		};

		await channel.publish(notification);

		// Give some time for the notification to be received
		await new Promise(resolve => setTimeout(resolve, 100));

		expect(received.length).toBe(1);
		expect(received[0].jobName).toBe('test-job');
		expect(received[0].priority).toBe(10);
	});

	it('should allow unsubscribing', async () => {
		const received: IJobNotification[] = [];

		const unsubscribe = channel.subscribe(notification => {
			received.push(notification);
		});

		await channel.publish({
			jobId: toJobId('test-1') as JobId,
			jobName: 'job-1',
			nextRunAt: new Date(),
			priority: 0,
			timestamp: new Date()
		});

		await new Promise(resolve => setTimeout(resolve, 100));
		expect(received.length).toBe(1);

		// Unsubscribe
		unsubscribe();

		await channel.publish({
			jobId: toJobId('test-2') as JobId,
			jobName: 'job-2',
			nextRunAt: new Date(),
			priority: 0,
			timestamp: new Date()
		});

		await new Promise(resolve => setTimeout(resolve, 100));
		expect(received.length).toBe(1); // Still 1, not 2
	});

	it('should throw when publishing on disconnected channel', async () => {
		await channel.disconnect();

		await expect(channel.publish({
			jobId: toJobId('test') as JobId,
			jobName: 'test',
			nextRunAt: new Date(),
			priority: 0,
			timestamp: new Date()
		})).rejects.toThrow('Cannot publish: channel not connected');
	});

	it('should disconnect and set state', async () => {
		await channel.disconnect();
		expect(channel.state).toBe('disconnected');
	});
});

// Unit tests that don't require database
describe('PostgresBackend unit tests', () => {
	it('should throw if no connection config provided', () => {
		expect(() => new PostgresBackend({})).toThrow('PostgresBackend requires connectionString or pool config');
	});

	it('should accept connectionString config', () => {
		const backend = new PostgresBackend({
			connectionString: 'postgresql://localhost/test'
		});
		expect(backend.repository).toBeDefined();
		expect(backend.notificationChannel).toBeDefined();
	});
});
