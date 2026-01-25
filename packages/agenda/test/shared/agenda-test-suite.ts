/**
 * Shared test suite for Agenda integration tests
 *
 * This file exports test suite factories that can be used to test Agenda
 * with any backend implementation (MongoDB, PostgreSQL, Redis, etc.)
 *
 * Usage:
 * ```typescript
 * import { agendaTestSuite } from 'agenda/test/shared';
 *
 * agendaTestSuite({
 *   name: 'Agenda with MongoDB',
 *   createBackend: async () => {
 *     const backend = new MongoBackend({ mongo: db });
 *     await backend.connect();
 *     return backend;
 *   },
 *   cleanupBackend: async (backend) => {
 *     await backend.disconnect();
 *   },
 *   clearJobs: async (backend) => {
 *     // Clear all jobs from the database
 *   }
 * });
 * ```
 */

import delay from 'delay';
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import type { IAgendaBackend, INotificationChannel } from '../../src';
import { Agenda } from '../../src';
import { Job } from '../../src/Job';

export interface AgendaTestConfig {
	/** Name for the test suite */
	name: string;
	/** Factory to create a fresh backend instance */
	createBackend: () => Promise<IAgendaBackend>;
	/** Cleanup function called after tests */
	cleanupBackend: (backend: IAgendaBackend) => Promise<void>;
	/** Clear all jobs between tests */
	clearJobs: (backend: IAgendaBackend) => Promise<void>;
	/** Optional notification channel factory */
	createNotificationChannel?: () => Promise<INotificationChannel>;
	/** Cleanup notification channel */
	cleanupNotificationChannel?: (channel: INotificationChannel) => Promise<void>;
	/** Skip specific tests if not supported */
	skip?: {
		forkMode?: boolean; // Skip fork mode tests (require specific file paths)
	};
}

/**
 * Helper to query jobs from agenda
 */
async function getJobs(agenda: Agenda, query: { name?: string } = {}): Promise<Job[]> {
	const result = await agenda.queryJobs(query);
	// queryJobs returns IJobWithState[], we need to convert to Job[]
	// For now, we'll create Job instances from the parameters
	return result.jobs.map(params => {
		const job = agenda.create(params.name, params.data);
		Object.assign(job.attrs, params);
		return job;
	});
}

/**
 * Creates a comprehensive test suite for Agenda with a specific backend
 */
export function agendaTestSuite(config: AgendaTestConfig): void {
	describe(`${config.name} - Agenda Integration`, () => {
		let backend: IAgendaBackend;
		let agenda: Agenda;

		const jobTimeout = 500;
		const jobType = 'do work';
		const jobProcessor = () => {};

		beforeAll(async () => {
			backend = await config.createBackend();
		});

		afterAll(async () => {
			await config.cleanupBackend(backend);
		});

		beforeEach(async () => {
			await config.clearJobs(backend);
			agenda = new Agenda({ backend });
			agenda.define('someJob', jobProcessor);
			agenda.define('send email', jobProcessor);
			agenda.define('some job', jobProcessor);
			agenda.define(jobType, jobProcessor);
		});

		afterEach(async () => {
			if (agenda) {
				await agenda.stop();
			}
			await config.clearJobs(backend);
		});

		describe('configuration', () => {
			it('should set processEvery', () => {
				agenda.processEvery('3 minutes');
				expect(agenda.attrs.processEvery).toBe(180000);
			});

			it('should set name', () => {
				agenda.name('test-name');
				expect(agenda.attrs.name).toBe('test-name');
			});

			it('should set maxConcurrency', () => {
				agenda.maxConcurrency(10);
				expect(agenda.attrs.maxConcurrency).toBe(10);
			});

			it('should set defaultConcurrency', () => {
				agenda.defaultConcurrency(3);
				expect(agenda.attrs.defaultConcurrency).toBe(3);
			});

			it('should set lockLimit', () => {
				agenda.lockLimit(5);
				expect(agenda.attrs.lockLimit).toBe(5);
			});

			it('should set defaultLockLimit', () => {
				agenda.defaultLockLimit(2);
				expect(agenda.attrs.defaultLockLimit).toBe(2);
			});

			it('should set defaultLockLifetime', () => {
				agenda.defaultLockLifetime(300000);
				expect(agenda.attrs.defaultLockLifetime).toBe(300000);
			});
		});

		describe('job definition', () => {
			it('should create a job', () => {
				const job = agenda.create('test job', { data: 1 });
				expect(job).toBeInstanceOf(Job);
			});

			it('should create a job with data', () => {
				const job = agenda.create('test job', { key: 'value' });
				expect(job.attrs.data).toEqual({ key: 'value' });
			});
		});

		describe('every()', () => {
			it('should schedule a job to run at an interval', async () => {
				await agenda.start();
				await agenda.every('5 minutes', 'test-interval-job');

				const jobs = await getJobs(agenda, { name: 'test-interval-job' });
				expect(jobs.length).toBe(1);
				expect(jobs[0].attrs.repeatInterval).toBe('5 minutes');
			});

			it('should schedule a job to run at a cron expression', async () => {
				await agenda.start();
				await agenda.every('0 6 * * *', 'test-cron-job');

				const jobs = await getJobs(agenda, { name: 'test-cron-job' });
				expect(jobs.length).toBe(1);
				expect(jobs[0].attrs.repeatInterval).toBe('0 6 * * *');
			});

			it('should update a job that was previously scheduled', async () => {
				await agenda.start();
				await agenda.every('1 minute', 'update-interval-job');
				await agenda.every('5 minutes', 'update-interval-job');

				const jobs = await getJobs(agenda, { name: 'update-interval-job' });
				expect(jobs.length).toBe(1);
				expect(jobs[0].attrs.repeatInterval).toBe('5 minutes');
			});
		});

		describe('schedule()', () => {
			it('should schedule a job for a specific time', async () => {
				await agenda.start();
				const when = new Date(Date.now() + 60000);
				const job = await agenda.schedule(when, 'test-schedule-job');

				expect(job.attrs.nextRunAt?.getTime()).toBe(when.getTime());
			});

			it('should schedule a job with human-readable time', async () => {
				await agenda.start();
				const job = await agenda.schedule('in 1 hour', 'test-human-schedule');

				expect(job.attrs.nextRunAt).toBeDefined();
				expect(job.attrs.nextRunAt!.getTime()).toBeGreaterThan(Date.now());
			});
		});

		describe('now()', () => {
			it('should schedule a job to run immediately', async () => {
				await agenda.start();
				const job = await agenda.now('test-now-job');

				expect(job.attrs.nextRunAt).toBeDefined();
				expect(job.attrs.nextRunAt!.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
			});

			it('should schedule a job with data', async () => {
				await agenda.start();
				const job = await agenda.now('test-now-data', { key: 'value' });

				expect(job.attrs.data).toEqual({ key: 'value' });
			});
		});

		describe('queryJobs()', () => {
			it('should return all jobs matching query', async () => {
				await agenda.start();
				await agenda.now('query-job-1');
				await agenda.now('query-job-2');
				await agenda.now('query-job-1');

				const result = await agenda.queryJobs({ name: 'query-job-1' });
				expect(result.jobs.length).toBe(2);
			});

			it('should return empty array when no jobs match', async () => {
				const result = await agenda.queryJobs({ name: 'non-existent' });
				expect(result.jobs).toEqual([]);
			});
		});

		describe('cancel()', () => {
			it('should cancel jobs matching query', async () => {
				await agenda.start();
				await agenda.now('cancel-test');
				await agenda.now('cancel-test');
				await agenda.now('keep-test');

				const cancelled = await agenda.cancel({ name: 'cancel-test' });
				expect(cancelled).toBe(2);

				const result = await agenda.queryJobs({});
				expect(result.jobs.length).toBe(1);
				expect(result.jobs[0].name).toBe('keep-test');
			});
		});

		describe('disable() / enable()', () => {
			it('should disable jobs matching query', async () => {
				await agenda.start();
				await agenda.now('disable-test');
				await agenda.now('disable-test');

				const disabled = await agenda.disable({ name: 'disable-test' });
				expect(disabled).toBe(2);

				const result = await agenda.queryJobs({ name: 'disable-test' });
				result.jobs.forEach(job => expect(job.disabled).toBe(true));
			});

			it('should enable disabled jobs', async () => {
				await agenda.start();
				const job = await agenda.now('enable-test');
				await job.disable().save();

				const enabled = await agenda.enable({ name: 'enable-test' });
				expect(enabled).toBe(1);

				const result = await agenda.queryJobs({ name: 'enable-test' });
				expect(result.jobs[0].disabled).toBeFalsy();
			});
		});

		describe('job processing', () => {
			it('should process a job', async () => {
				let processed = false;
				agenda.define('process-test', async () => {
					processed = true;
				});

				await agenda.start();
				await agenda.now('process-test');

				await delay(jobTimeout);
				expect(processed).toBe(true);
			});

			it('should pass job instance to processor', async () => {
				let receivedJob: Job | undefined;
				agenda.define('job-instance-test', async (job: Job) => {
					receivedJob = job;
				});

				await agenda.start();
				await agenda.now('job-instance-test', { testData: 123 });

				await delay(jobTimeout);
				expect(receivedJob).toBeDefined();
				expect(receivedJob?.attrs.name).toBe('job-instance-test');
				expect(receivedJob?.attrs.data).toEqual({ testData: 123 });
			});

			it('should not run disabled jobs', async () => {
				let processed = false;
				agenda.define('disabled-process-test', async () => {
					processed = true;
				});

				const job = await agenda.now('disabled-process-test');
				await job.disable().save();
				await agenda.start();

				await delay(jobTimeout);
				expect(processed).toBe(false);
			});

			it('should emit success event on completion', async () => {
				let successEmitted = false;
				agenda.define('success-event-test', async () => {});

				agenda.on('success:success-event-test', () => {
					successEmitted = true;
				});

				await agenda.start();
				await agenda.now('success-event-test');

				await delay(jobTimeout);
				expect(successEmitted).toBe(true);
			});

			it('should emit fail event on error', async () => {
				let failEmitted = false;
				let failError: Error | undefined;
				agenda.define('fail-event-test', async () => {
					throw new Error('Test error');
				});

				agenda.on('fail:fail-event-test', (err: Error) => {
					failEmitted = true;
					failError = err;
				});

				await agenda.start();
				await agenda.now('fail-event-test');

				await delay(jobTimeout);
				expect(failEmitted).toBe(true);
				expect(failError?.message).toBe('Test error');
			});
		});

		describe('job locking', () => {
			it('should lock jobs during processing', async () => {
				let lockedDuringProcessing = false;
				agenda.define('lock-test', async () => {
					const result = await agenda.queryJobs({ name: 'lock-test' });
					lockedDuringProcessing =
						result.jobs[0].lockedAt !== null && result.jobs[0].lockedAt !== undefined;
					await delay(100);
				});

				await agenda.start();
				await agenda.now('lock-test');

				await delay(jobTimeout);
				expect(lockedDuringProcessing).toBe(true);
			});

			it('should clear locks on stop', async () => {
				agenda.define('clear-lock-test', async () => {
					await delay(5000);
				});

				await agenda.start();
				await agenda.now('clear-lock-test');

				await delay(200);
				await agenda.stop();

				const result = await agenda.queryJobs({ name: 'clear-lock-test' });
				expect(result.jobs[0].lockedAt).toBeFalsy();
			});
		});

		describe('concurrency', () => {
			it('should respect maxConcurrency', async () => {
				let running = 0;
				let maxRunning = 0;

				agenda.maxConcurrency(2);
				agenda.define('concurrency-test', async () => {
					running++;
					maxRunning = Math.max(maxRunning, running);
					await delay(200);
					running--;
				});

				await agenda.start();
				await Promise.all([
					agenda.now('concurrency-test'),
					agenda.now('concurrency-test'),
					agenda.now('concurrency-test'),
					agenda.now('concurrency-test')
				]);

				await delay(1500);
				expect(maxRunning).toBeLessThanOrEqual(2);
			});

			it('should respect per-job concurrency', async () => {
				let running = 0;
				let maxRunning = 0;

				agenda.define(
					'per-job-concurrency',
					async () => {
						running++;
						maxRunning = Math.max(maxRunning, running);
						await delay(200);
						running--;
					},
					{ concurrency: 1 }
				);

				await agenda.start();
				await Promise.all([
					agenda.now('per-job-concurrency'),
					agenda.now('per-job-concurrency'),
					agenda.now('per-job-concurrency')
				]);

				await delay(1500);
				expect(maxRunning).toBe(1);
			});
		});

		describe('priority', () => {
			it('should process higher priority jobs first', async () => {
				const processOrder: number[] = [];

				agenda.define('priority-test', async (job: Job) => {
					processOrder.push(job.attrs.priority || 0);
				});

				// Schedule jobs - low priority first to ensure they're in queue
				const j1 = await agenda.now('priority-test');
				await j1.priority(-10).save();
				const j2 = await agenda.now('priority-test');
				await j2.priority(10).save();
				const j3 = await agenda.now('priority-test');
				await j3.priority(0).save();

				agenda.maxConcurrency(1); // Process one at a time
				await agenda.start();

				await delay(jobTimeout * 4);

				// Higher priority (10) should be processed first
				expect(processOrder[0]).toBe(10);
			});
		});
	});
}
