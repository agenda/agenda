/**
 * Shared test suite for IJobRepository implementations
 *
 * This file exports test suite factories that can be used to test any
 * IJobRepository implementation (MongoDB, PostgreSQL, etc.)
 *
 * Usage:
 * ```typescript
 * import { repositoryTestSuite } from 'agenda/test/shared';
 *
 * repositoryTestSuite({
 *   name: 'PostgresJobRepository',
 *   createRepository: async () => {
 *     const repo = new PostgresJobRepository(config);
 *     await repo.connect();
 *     return repo;
 *   },
 *   cleanupRepository: async (repo) => {
 *     await repo.disconnect();
 *   }
 * });
 * ```
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { IJobRepository, IJobParameters } from '../../src/index.js';

export interface RepositoryTestConfig {
	/** Name for the test suite */
	name: string;
	/** Factory to create a fresh repository instance */
	createRepository: () => Promise<IJobRepository>;
	/** Cleanup function called after each test */
	cleanupRepository: (repo: IJobRepository) => Promise<void>;
	/** Optional: clear all jobs between tests (if not provided, uses removeJobs) */
	clearJobs?: (repo: IJobRepository) => Promise<void>;
	/** Skip specific tests if not supported by the backend */
	skip?: {
		uniqueConstraints?: boolean;
		jsonbQueries?: boolean;
	};
}

/**
 * Creates a test suite for IJobRepository implementations
 */
export function repositoryTestSuite(config: RepositoryTestConfig): void {
	describe(`${config.name} - IJobRepository`, () => {
		let repo: IJobRepository;

		const clearJobs = async () => {
			if (config.clearJobs) {
				await config.clearJobs(repo);
			} else {
				// Default: remove all jobs by querying for all names
				const names = await repo.getDistinctJobNames();
				if (names.length > 0) {
					await repo.removeJobs({ names });
				}
			}
		};

		beforeEach(async () => {
			repo = await config.createRepository();
			await clearJobs();
		});

		afterEach(async () => {
			await clearJobs();
			await config.cleanupRepository(repo);
		});

		describe('saveJob', () => {
			it('should save a new job and assign an ID', async () => {
				const job: IJobParameters = {
					name: 'test-job',
					priority: 10,
					nextRunAt: new Date(),
					type: 'normal',
					data: { foo: 'bar' }
				};

				const saved = await repo.saveJob(job);

				expect(saved._id).toBeDefined();
				expect(saved.name).toBe('test-job');
				expect(saved.priority).toBe(10);
				expect(saved.type).toBe('normal');
				expect(saved.data).toEqual({ foo: 'bar' });
			});

			it('should update an existing job', async () => {
				const job: IJobParameters = {
					name: 'update-test',
					priority: 5,
					nextRunAt: new Date(),
					type: 'normal',
					data: { version: 1 }
				};

				const saved = await repo.saveJob(job);
				const updated = await repo.saveJob({
					...saved,
					priority: 20,
					data: { version: 2 }
				});

				expect(updated._id).toBe(saved._id);
				expect(updated.priority).toBe(20);
				expect(updated.data).toEqual({ version: 2 });
			});

			it('should handle single type jobs (upsert by name)', async () => {
				const job1: IJobParameters = {
					name: 'single-job',
					priority: 5,
					nextRunAt: new Date(Date.now() + 60000),
					type: 'single',
					data: { run: 1 }
				};

				const saved1 = await repo.saveJob(job1);

				const job2: IJobParameters = {
					name: 'single-job',
					priority: 10,
					nextRunAt: new Date(Date.now() + 120000),
					type: 'single',
					data: { run: 2 }
				};

				const saved2 = await repo.saveJob(job2);

				// Should be same job, updated
				expect(saved2._id).toBe(saved1._id);
				expect(saved2.priority).toBe(10);
				expect(saved2.data).toEqual({ run: 2 });

				// Verify only one job exists
				const result = await repo.queryJobs({ name: 'single-job' });
				expect(result.total).toBe(1);
			});

			it('should preserve disabled flag', async () => {
				const job: IJobParameters = {
					name: 'disabled-job',
					priority: 0,
					nextRunAt: new Date(),
					type: 'normal',
					data: {},
					disabled: true
				};

				const saved = await repo.saveJob(job);
				expect(saved.disabled).toBe(true);

				const retrieved = await repo.getJobById(saved._id!.toString());
				expect(retrieved?.disabled).toBe(true);
			});
		});

		describe('getJobById', () => {
			it('should return job by ID', async () => {
				const saved = await repo.saveJob({
					name: 'get-by-id-test',
					priority: 5,
					nextRunAt: new Date(),
					type: 'normal',
					data: { key: 'value' }
				});

				const retrieved = await repo.getJobById(saved._id!.toString());

				expect(retrieved).not.toBeNull();
				expect(retrieved!._id).toBe(saved._id);
				expect(retrieved!.name).toBe('get-by-id-test');
				expect(retrieved!.data).toEqual({ key: 'value' });
			});

			it('should return null for non-existent ID', async () => {
				// Create and delete a job to get a valid ID format
				const job = await repo.saveJob({
					name: 'temp-job',
					priority: 0,
					nextRunAt: new Date(),
					type: 'normal',
					data: {}
				});

				await repo.removeJobs({ id: job._id! });

				// Query for the deleted job - should return null
				const result = await repo.getJobById(job._id!.toString());
				expect(result).toBeNull();
			});
		});

		describe('queryJobs', () => {
			beforeEach(async () => {
				// Create test jobs
				await repo.saveJob({
					name: 'job-a',
					priority: 10,
					nextRunAt: new Date(Date.now() + 60000),
					type: 'normal',
					data: { type: 'alpha', count: 1 }
				});
				await repo.saveJob({
					name: 'job-b',
					priority: 5,
					nextRunAt: new Date(Date.now() + 120000),
					type: 'normal',
					data: { type: 'beta', count: 2 }
				});
				await repo.saveJob({
					name: 'job-a',
					priority: 15,
					nextRunAt: new Date(Date.now() + 180000),
					type: 'normal',
					data: { type: 'alpha', count: 3 }
				});
			});

			it('should query all jobs', async () => {
				const result = await repo.queryJobs();
				expect(result.total).toBe(3);
				expect(result.jobs.length).toBe(3);
			});

			it('should query jobs by name', async () => {
				const result = await repo.queryJobs({ name: 'job-a' });
				expect(result.total).toBe(2);
				result.jobs.forEach(job => {
					expect(job.name).toBe('job-a');
				});
			});

			it('should query jobs by multiple names', async () => {
				const result = await repo.queryJobs({ names: ['job-a', 'job-b'] });
				expect(result.total).toBe(3);
			});

			it('should query jobs by search pattern', async () => {
				const result = await repo.queryJobs({ search: 'job' });
				expect(result.total).toBe(3);
			});

			it('should support pagination with skip and limit', async () => {
				const result = await repo.queryJobs({ skip: 1, limit: 1 });
				expect(result.jobs.length).toBe(1);
				expect(result.total).toBe(3); // Total count should still be 3
			});

			it('should filter disabled jobs when includeDisabled is false', async () => {
				await repo.saveJob({
					name: 'disabled-job',
					priority: 0,
					nextRunAt: new Date(),
					type: 'normal',
					data: {},
					disabled: true
				});

				const withDisabled = await repo.queryJobs({ includeDisabled: true });
				const withoutDisabled = await repo.queryJobs({ includeDisabled: false });

				expect(withDisabled.total).toBe(4);
				expect(withoutDisabled.total).toBe(3);
			});
		});

		describe('removeJobs', () => {
			it('should remove jobs by name', async () => {
				await repo.saveJob({
					name: 'remove-test',
					priority: 0,
					nextRunAt: new Date(),
					type: 'normal',
					data: {}
				});
				await repo.saveJob({
					name: 'remove-test',
					priority: 0,
					nextRunAt: new Date(),
					type: 'normal',
					data: {}
				});
				await repo.saveJob({
					name: 'keep-test',
					priority: 0,
					nextRunAt: new Date(),
					type: 'normal',
					data: {}
				});

				const removed = await repo.removeJobs({ name: 'remove-test' });
				expect(removed).toBe(2);

				const remaining = await repo.queryJobs();
				expect(remaining.total).toBe(1);
				expect(remaining.jobs[0].name).toBe('keep-test');
			});

			it('should remove jobs by ID', async () => {
				const saved = await repo.saveJob({
					name: 'remove-by-id',
					priority: 0,
					nextRunAt: new Date(),
					type: 'normal',
					data: {}
				});

				const removed = await repo.removeJobs({ id: saved._id! });
				expect(removed).toBe(1);

				const retrieved = await repo.getJobById(saved._id!.toString());
				expect(retrieved).toBeNull();
			});

			it('should remove jobs by multiple IDs', async () => {
				const job1 = await repo.saveJob({
					name: 'multi-remove-1',
					priority: 0,
					nextRunAt: new Date(),
					type: 'normal',
					data: {}
				});
				const job2 = await repo.saveJob({
					name: 'multi-remove-2',
					priority: 0,
					nextRunAt: new Date(),
					type: 'normal',
					data: {}
				});
				await repo.saveJob({
					name: 'keep',
					priority: 0,
					nextRunAt: new Date(),
					type: 'normal',
					data: {}
				});

				const removed = await repo.removeJobs({ ids: [job1._id!, job2._id!] });
				expect(removed).toBe(2);

				const remaining = await repo.queryJobs();
				expect(remaining.total).toBe(1);
			});

			it('should return 0 when no jobs match', async () => {
				const removed = await repo.removeJobs({ name: 'non-existent' });
				expect(removed).toBe(0);
			});
		});

		describe('getDistinctJobNames', () => {
			it('should return unique job names', async () => {
				await repo.saveJob({
					name: 'name-a',
					priority: 0,
					nextRunAt: new Date(),
					type: 'normal',
					data: {}
				});
				await repo.saveJob({
					name: 'name-b',
					priority: 0,
					nextRunAt: new Date(),
					type: 'normal',
					data: {}
				});
				await repo.saveJob({
					name: 'name-a',
					priority: 0,
					nextRunAt: new Date(),
					type: 'normal',
					data: {}
				});

				const names = await repo.getDistinctJobNames();
				expect(names).toContain('name-a');
				expect(names).toContain('name-b');
				expect(names.length).toBe(2);
			});

			it('should return empty array when no jobs exist', async () => {
				const names = await repo.getDistinctJobNames();
				expect(names).toEqual([]);
			});
		});

		describe('getQueueSize', () => {
			it('should count jobs ready to run', async () => {
				// Jobs in the past (should be counted)
				await repo.saveJob({
					name: 'past-job-1',
					priority: 0,
					nextRunAt: new Date(Date.now() - 60000),
					type: 'normal',
					data: {}
				});
				await repo.saveJob({
					name: 'past-job-2',
					priority: 0,
					nextRunAt: new Date(Date.now() - 30000),
					type: 'normal',
					data: {}
				});
				// Job in the future (should not be counted)
				await repo.saveJob({
					name: 'future-job',
					priority: 0,
					nextRunAt: new Date(Date.now() + 60000),
					type: 'normal',
					data: {}
				});

				const queueSize = await repo.getQueueSize();
				expect(queueSize).toBe(2);
			});

			it('should return 0 when no jobs are ready', async () => {
				await repo.saveJob({
					name: 'future-job',
					priority: 0,
					nextRunAt: new Date(Date.now() + 60000),
					type: 'normal',
					data: {}
				});

				const queueSize = await repo.getQueueSize();
				expect(queueSize).toBe(0);
			});
		});

		describe('locking', () => {
			it('should lock a job', async () => {
				const saved = await repo.saveJob({
					name: 'lock-test',
					priority: 0,
					nextRunAt: new Date(Date.now() - 1000),
					type: 'normal',
					data: {}
				});

				const locked = await repo.lockJob(saved);

				expect(locked).toBeDefined();
				expect(locked!.lockedAt).toBeDefined();
				expect(locked!._id).toBe(saved._id);
			});

			it('should not lock an already locked job', async () => {
				const saved = await repo.saveJob({
					name: 'double-lock-test',
					priority: 0,
					nextRunAt: new Date(Date.now() - 1000),
					type: 'normal',
					data: {}
				});

				const locked1 = await repo.lockJob(saved);
				expect(locked1).toBeDefined();

				// Try to lock again with original (unlocked) job params
				const locked2 = await repo.lockJob(saved);
				expect(locked2).toBeUndefined();
			});

			it('should unlock a job', async () => {
				const saved = await repo.saveJob({
					name: 'unlock-test',
					priority: 0,
					nextRunAt: new Date(Date.now() - 1000),
					type: 'normal',
					data: {}
				});

				const locked = await repo.lockJob(saved);
				expect(locked!.lockedAt).toBeDefined();

				await repo.unlockJob(locked!);

				const retrieved = await repo.getJobById(saved._id!.toString());
				// Accept both null and undefined as "not locked"
				expect(retrieved!.lockedAt == null).toBe(true);
			});

			it('should unlock multiple jobs', async () => {
				const job1 = await repo.saveJob({
					name: 'multi-unlock-1',
					priority: 0,
					nextRunAt: new Date(Date.now() - 1000),
					type: 'normal',
					data: {}
				});
				const job2 = await repo.saveJob({
					name: 'multi-unlock-2',
					priority: 0,
					nextRunAt: new Date(Date.now() - 1000),
					type: 'normal',
					data: {}
				});

				await repo.lockJob(job1);
				await repo.lockJob(job2);

				await repo.unlockJobs([job1._id!, job2._id!]);

				const retrieved1 = await repo.getJobById(job1._id!.toString());
				const retrieved2 = await repo.getJobById(job2._id!.toString());

				// Accept both null and undefined as "not locked"
				expect(retrieved1!.lockedAt == null).toBe(true);
				expect(retrieved2!.lockedAt == null).toBe(true);
			});
		});

		describe('getNextJobToRun', () => {
			it('should get the next job to run', async () => {
				await repo.saveJob({
					name: 'runner-test',
					priority: 5,
					nextRunAt: new Date(Date.now() - 60000),
					type: 'normal',
					data: { order: 'first' }
				});

				const now = new Date();
				const nextScanAt = new Date(now.getTime() + 5000);
				const lockDeadline = new Date(now.getTime() - 600000);

				const next = await repo.getNextJobToRun('runner-test', nextScanAt, lockDeadline, now);

				expect(next).toBeDefined();
				expect(next!.name).toBe('runner-test');
				expect(next!.lockedAt).toBeDefined();
			});

			it('should respect priority ordering', async () => {
				// Use the same nextRunAt time so priority is the deciding factor
				const sameTime = new Date(Date.now() - 60000);

				await repo.saveJob({
					name: 'priority-test',
					priority: 5,
					nextRunAt: sameTime,
					type: 'normal',
					data: { priority: 'low' }
				});
				await repo.saveJob({
					name: 'priority-test',
					priority: 10,
					nextRunAt: sameTime,
					type: 'normal',
					data: { priority: 'high' }
				});

				const now = new Date();
				const nextScanAt = new Date(now.getTime() + 5000);
				const lockDeadline = new Date(now.getTime() - 600000);

				const next = await repo.getNextJobToRun('priority-test', nextScanAt, lockDeadline, now);

				expect(next).toBeDefined();
				expect(next!.priority).toBe(10);
				expect(next!.data).toEqual({ priority: 'high' });
			});

			it('should not return disabled jobs', async () => {
				await repo.saveJob({
					name: 'disabled-test',
					priority: 0,
					nextRunAt: new Date(Date.now() - 60000),
					type: 'normal',
					data: {},
					disabled: true
				});

				const now = new Date();
				const nextScanAt = new Date(now.getTime() + 5000);
				const lockDeadline = new Date(now.getTime() - 600000);

				const next = await repo.getNextJobToRun('disabled-test', nextScanAt, lockDeadline, now);

				expect(next).toBeUndefined();
			});

			it('should return undefined when no jobs are ready', async () => {
				await repo.saveJob({
					name: 'future-test',
					priority: 0,
					nextRunAt: new Date(Date.now() + 60000),
					type: 'normal',
					data: {}
				});

				const now = new Date();
				const nextScanAt = new Date(now.getTime() + 5000);
				const lockDeadline = new Date(now.getTime() - 600000);

				const next = await repo.getNextJobToRun('future-test', nextScanAt, lockDeadline, now);

				expect(next).toBeUndefined();
			});
		});

		describe('saveJobState', () => {
			it('should update job state fields', async () => {
				const saved = await repo.saveJob({
					name: 'state-test',
					priority: 0,
					nextRunAt: new Date(),
					type: 'normal',
					data: {}
				});

				const now = new Date();
				await repo.saveJobState({
					...saved,
					lastRunAt: now,
					lastFinishedAt: now,
					progress: 50,
					failCount: 1,
					failReason: 'Test error',
					failedAt: now
				});

				const retrieved = await repo.getJobById(saved._id!.toString());

				expect(retrieved!.lastRunAt).toBeDefined();
				expect(retrieved!.lastFinishedAt).toBeDefined();
				expect(retrieved!.progress).toBe(50);
				expect(retrieved!.failCount).toBe(1);
				expect(retrieved!.failReason).toBe('Test error');
				expect(retrieved!.failedAt).toBeDefined();
			});

			it('should clear lockedAt when job completes', async () => {
				const saved = await repo.saveJob({
					name: 'complete-test',
					priority: 0,
					nextRunAt: new Date(Date.now() - 1000),
					type: 'normal',
					data: {}
				});

				const locked = await repo.lockJob(saved);
				expect(locked!.lockedAt).toBeDefined();

				await repo.saveJobState({
					...locked!,
					lockedAt: undefined,
					lastFinishedAt: new Date()
				});

				const retrieved = await repo.getJobById(saved._id!.toString());
				// Accept both null and undefined as "not locked"
				expect(retrieved!.lockedAt == null).toBe(true);
			});
		});

		describe('getJobsOverview', () => {
			it('should return overview of all job types', async () => {
				// Create jobs with different states
				await repo.saveJob({
					name: 'overview-job',
					priority: 0,
					nextRunAt: new Date(Date.now() + 60000), // scheduled
					type: 'normal',
					data: {}
				});
				await repo.saveJob({
					name: 'overview-job',
					priority: 0,
					nextRunAt: null, // completed (no next run)
					type: 'normal',
					data: {},
					lastFinishedAt: new Date()
				});
				await repo.saveJob({
					name: 'other-job',
					priority: 0,
					nextRunAt: new Date(Date.now() + 60000),
					type: 'normal',
					data: {}
				});

				const overview = await repo.getJobsOverview();

				expect(overview.length).toBeGreaterThanOrEqual(2);

				const overviewJob = overview.find(o => o.name === 'overview-job');
				expect(overviewJob).toBeDefined();
				expect(overviewJob!.total).toBe(2);
			});
		});
	});
}
