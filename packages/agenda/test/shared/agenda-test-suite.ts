import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import type { ForkOptions } from 'child_process';
import type { AgendaBackend, NotificationChannel } from '../../src/index.js';
import { Agenda } from '../../src/index.js';
import { Job } from '../../src/Job.js';
import { delay, waitForEvent, waitForEvents } from './test-utils.js';
import someJobDefinition from '../fixtures/someJobDefinition.js';

export interface ForkHelperConfig {
	/** Path to the fork helper script (relative to cwd) */
	path: string;
	/** Fork options (e.g., execArgv for tsx loader, env for environment variables) */
	options?: ForkOptions;
}

export interface AgendaTestConfig {
	/** Name for the test suite */
	name: string;
	/** Factory to create a fresh backend instance */
	createBackend: () => Promise<AgendaBackend>;
	/** Cleanup function called after tests */
	cleanupBackend: (backend: AgendaBackend) => Promise<void>;
	/** Clear all jobs between tests */
	clearJobs: (backend: AgendaBackend) => Promise<void>;
	/** Optional notification channel factory */
	createNotificationChannel?: () => Promise<NotificationChannel>;
	/** Cleanup notification channel */
	cleanupNotificationChannel?: (channel: NotificationChannel) => Promise<void>;
	/** Fork mode configuration (required if forkMode tests are enabled) */
	forkHelper?: ForkHelperConfig;
	/** Skip specific tests if not supported */
	skip?: {
		forkMode?: boolean; // Skip fork mode tests (require specific file paths)
	};
}

export function agendaTestSuite(config: AgendaTestConfig): void {
	describe(`${config.name} - Agenda Integration`, () => {
		let backend: AgendaBackend;
		let agenda: Agenda;

		const jobProcessor = () => {};

		beforeAll(async () => {
			backend = await config.createBackend();
		});

		afterAll(async () => {
			await config.cleanupBackend(backend);
		});

		beforeEach(async () => {
			await config.clearJobs(backend);
			agenda = new Agenda({
				backend,
				processEvery: 100
			});
			await agenda.ready;
		});

		afterEach(async () => {
			if (agenda) {
				await agenda.stop();
			}
			await config.clearJobs(backend);
		});

		describe('every()', () => {
			it('should schedule a job to run at an interval', async () => {
				await agenda.every('5 minutes', 'test-interval-job');

				const result = await agenda.queryJobs({ name: 'test-interval-job' });
				expect(result.jobs.length).toBe(1);
				expect(result.jobs[0].repeatInterval).toBe('5 minutes');
			});

			it('should schedule a job to run at a cron expression', async () => {
				await agenda.every('0 6 * * *', 'test-cron-job');

				const result = await agenda.queryJobs({ name: 'test-cron-job' });
				expect(result.jobs.length).toBe(1);
				expect(result.jobs[0].repeatInterval).toBe('0 6 * * *');
			});

			it('should update a job that was previously scheduled', async () => {
				await agenda.every('1 minute', 'update-interval-job');
				await agenda.every('5 minutes', 'update-interval-job');

				const result = await agenda.queryJobs({ name: 'update-interval-job' });
				expect(result.jobs.length).toBe(1);
				expect(result.jobs[0].repeatInterval).toBe('5 minutes');
			});

			it('should accept options object with timezone', async () => {
				agenda.define('timezoneJob', jobProcessor);
				const job = await agenda.every('5 minutes', 'timezoneJob', {}, { timezone: 'America/New_York' });
				expect(job.attrs.repeatTimezone).toBe('America/New_York');
			});

			it('should set skipImmediate option', async () => {
				agenda.define('skipImmediateJob', jobProcessor);
				agenda.define('noSkipJob', jobProcessor);
				// Without skipImmediate, job should run immediately (nextRunAt ~ now)
				const jobWithoutSkip = await agenda.every('5 minutes', 'noSkipJob', {});
				const immediateDiff = Math.abs(
					(jobWithoutSkip.attrs.nextRunAt?.getTime() || 0) - Date.now()
				);

				// With skipImmediate, job should run in ~5 minutes (nextRunAt > now + 4 minutes)
				const jobWithSkip = await agenda.every('5 minutes', 'skipImmediateJob', {}, { skipImmediate: true });
				const skipDiff = (jobWithSkip.attrs.nextRunAt?.getTime() || 0) - Date.now();

				// Without skip, should run very soon (within 1 second)
				expect(immediateDiff).toBeLessThan(1000);
				// With skip, should run in ~5 minutes (at least 4 minutes from now)
				expect(skipDiff).toBeGreaterThan(4 * 60 * 1000);
			});

			it('should create multiple jobs with array of names', async () => {
				agenda.define('arrayJob1', jobProcessor);
				agenda.define('arrayJob2', jobProcessor);
				const jobs = await agenda.every('5 minutes', ['arrayJob1', 'arrayJob2']) as Job[];
				expect(jobs).toHaveLength(2);
				expect(jobs.map(j => j.attrs.name)).toContain('arrayJob1');
				expect(jobs.map(j => j.attrs.name)).toContain('arrayJob2');
			});
		});

		describe('schedule()', () => {
			it('should schedule a job for a specific time', async () => {
				const when = new Date(Date.now() + 60000);
				const job = await agenda.schedule(when, 'test-schedule-job');

				expect(job.attrs.nextRunAt?.getTime()).toBe(when.getTime());
			});

			it('should schedule a job with human-readable time', async () => {
				const job = await agenda.schedule('in 1 hour', 'test-human-schedule');

				expect(job.attrs.nextRunAt).toBeDefined();
				expect(job.attrs.nextRunAt!.getTime()).toBeGreaterThan(Date.now());
			});

			it('should create multiple jobs with array of names', async () => {
				agenda.define('scheduleArrayJob1', jobProcessor);
				agenda.define('scheduleArrayJob2', jobProcessor);
				const when = new Date(Date.now() + 60000);
				const jobs = await agenda.schedule(when, ['scheduleArrayJob1', 'scheduleArrayJob2']) as Job[];
				expect(jobs).toHaveLength(2);
			});
		});

		describe('now()', () => {
			it('should schedule a job to run immediately', async () => {
				const job = await agenda.now('test-now-job');

				expect(job.attrs.nextRunAt).toBeDefined();
				expect(job.attrs.nextRunAt!.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
			});

			it('should schedule a job with data', async () => {
				const job = await agenda.now('test-now-data', { key: 'value' });

				expect(job.attrs.data).toEqual({ key: 'value' });
			});
		});

		describe('queryJobs()', () => {
			it('should return all jobs matching query', async () => {
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

			it('should limit results', async () => {
				await agenda.now('limit-test');
				await agenda.now('limit-test');
				await agenda.now('limit-test');

				const result = await agenda.queryJobs({ name: 'limit-test', limit: 2 });
				expect(result.jobs.length).toBe(2);
				expect(result.total).toBe(3);
			});

			it('should skip results', async () => {
				await agenda.now('skip-test');
				await agenda.now('skip-test');
				await agenda.now('skip-test');

				const result = await agenda.queryJobs({ name: 'skip-test', skip: 2 });
				expect(result.jobs.length).toBe(1);
			});

			it('should combine limit and skip', async () => {
				await agenda.now('limit-skip-test');
				await agenda.now('limit-skip-test');
				await agenda.now('limit-skip-test');
				await agenda.now('limit-skip-test');
				await agenda.now('limit-skip-test');

				const result = await agenda.queryJobs({ name: 'limit-skip-test', limit: 2, skip: 2 });
				expect(result.jobs.length).toBe(2);
			});

			it('should sort results', async () => {
				const j1 = await agenda.now('sort-test', { order: 3 });
				await j1.priority(3).save();
				const j2 = await agenda.now('sort-test', { order: 1 });
				await j2.priority(1).save();
				const j3 = await agenda.now('sort-test', { order: 2 });
				await j3.priority(2).save();

				const result = await agenda.queryJobs({
					name: 'sort-test',
					sort: { priority: 'desc' }
				});

				expect(result.jobs.length).toBe(3);
				expect(result.jobs[0].priority).toBe(3);
				expect(result.jobs[1].priority).toBe(2);
				expect(result.jobs[2].priority).toBe(1);
			});
		});

		describe('cancel()', () => {
			it('should cancel jobs matching query', async () => {
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

		describe('job disable/enable', () => {
			it('should disable a job via Job.disable()', async () => {
				const job = await agenda.now('disable-test');
				await job.disable().save();

				const result = await agenda.queryJobs({ name: 'disable-test' });
				expect(result.jobs[0].disabled).toBe(true);
			});

			it('should enable a disabled job via Job.enable()', async () => {
				const job = await agenda.now('enable-test');
				await job.disable().save();

				// Re-fetch and enable
				const jobs = (await agenda.queryJobs({ name: 'enable-test' })).jobs;
				const jobToEnable = agenda.create(jobs[0].name, jobs[0].data);
				Object.assign(jobToEnable.attrs, jobs[0]);
				await jobToEnable.enable().save();

				const result = await agenda.queryJobs({ name: 'enable-test' });
				expect(result.jobs[0].disabled).toBeFalsy();
			});

			it('should not run disabled jobs', async () => {
				let processed = false;
				agenda.define('disabled-process-test', async () => {
					processed = true;
				});

				const job = await agenda.now('disabled-process-test');
				await job.disable().save();
				await agenda.start();

				// Wait a bit to ensure job would have been picked up
				await new Promise(resolve => setTimeout(resolve, 500));
				expect(processed).toBe(false);
			});

			it('should disable jobs matching query via agenda.disable()', async () => {
				await agenda.now('bulk-disable-test');
				await agenda.now('bulk-disable-test');

				const disabled = await agenda.disable({ name: 'bulk-disable-test' });
				expect(disabled).toBe(2);

				const result = await agenda.queryJobs({ name: 'bulk-disable-test' });
				result.jobs.forEach(job => expect(job.disabled).toBe(true));
			});

			it('should enable disabled jobs via agenda.enable()', async () => {
				const job = await agenda.now('bulk-enable-test');
				await job.disable().save();

				const enabled = await agenda.enable({ name: 'bulk-enable-test' });
				expect(enabled).toBe(1);

				const result = await agenda.queryJobs({ name: 'bulk-enable-test' });
				expect(result.jobs[0].disabled).toBeFalsy();
			});

			it('should return 0 when no jobs match disable query', async () => {
				const disabled = await agenda.disable({ name: 'non-existent-job' });
				expect(disabled).toBe(0);
			});

			it('should return 0 when no options provided to disable', async () => {
				const disabled = await agenda.disable({});
				expect(disabled).toBe(0);
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

				await waitForEvent(agenda, 'complete:process-test');
				expect(processed).toBe(true);
			});

			it('should pass job instance to processor', async () => {
				let receivedJob: Job | undefined;
				agenda.define('job-instance-test', async (job: Job) => {
					receivedJob = job;
				});

				await agenda.start();
				await agenda.now('job-instance-test', { testData: 123 });

				await waitForEvent(agenda, 'complete:job-instance-test');
				expect(receivedJob).toBeDefined();
				expect(receivedJob?.attrs.name).toBe('job-instance-test');
				expect(receivedJob?.attrs.data).toEqual({ testData: 123 });
			});

			it('should emit success event on completion', async () => {
				let successEmitted = false;
				agenda.define('success-event-test', async () => {});

				agenda.on('success:success-event-test', () => {
					successEmitted = true;
				});

				await agenda.start();
				await agenda.now('success-event-test');

				await waitForEvent(agenda, 'complete:success-event-test');
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

				await waitForEvent(agenda, 'complete:fail-event-test');
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
				});

				await agenda.start();
				await agenda.now('lock-test');

				await waitForEvent(agenda, 'complete:lock-test');
				expect(lockedDuringProcessing).toBe(true);
			});

			it('should clear locks on stop', async () => {
				agenda.define('clear-lock-test', async () => {
					await new Promise(resolve => setTimeout(resolve, 5000));
				});

				await agenda.start();
				await agenda.now('clear-lock-test');

				// Wait for job to start
				await waitForEvent(agenda, 'start:clear-lock-test');
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
					await new Promise(resolve => setTimeout(resolve, 100));
					running--;
				});

				await agenda.start();
				await Promise.all([
					agenda.now('concurrency-test'),
					agenda.now('concurrency-test'),
					agenda.now('concurrency-test'),
					agenda.now('concurrency-test')
				]);

				await waitForEvents(agenda, 'complete:concurrency-test', 4);
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
						await new Promise(resolve => setTimeout(resolve, 100));
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

				await waitForEvents(agenda, 'complete:per-job-concurrency', 3);
				expect(maxRunning).toBe(1);
			});
		});

		describe('priority', () => {
			it('should process higher priority jobs first', async () => {
				const processOrder: number[] = [];

				agenda.define('priority-test', async (job: Job) => {
					processOrder.push(job.attrs.priority || 0);
				});

				// Use the same nextRunAt for all jobs so priority is the deciding factor
				const sameTime = new Date(Date.now() - 1000); // 1 second in the past

				// Create jobs with same nextRunAt but different priorities
				const j1 = agenda.create('priority-test');
				j1.attrs.nextRunAt = sameTime;
				await j1.priority(-10).save();

				const j2 = agenda.create('priority-test');
				j2.attrs.nextRunAt = sameTime;
				await j2.priority(10).save();

				const j3 = agenda.create('priority-test');
				j3.attrs.nextRunAt = sameTime;
				await j3.priority(0).save();

				agenda.maxConcurrency(1); // Process one at a time
				await agenda.start();

				await waitForEvents(agenda, 'complete:priority-test', 3);

				// Higher priority (10) should be processed first
				expect(processOrder[0]).toBe(10);
			});
		});

		describe('lock limits', () => {
			it('should not lock more than agenda lockLimit jobs', async () => {
				agenda.lockLimit(1);
				agenda.processEvery(100);

				agenda.define('lock-limit-job', (_job, _cb) => {
					// This job never finishes
				});

				await agenda.start();

				await Promise.all([
					agenda.now('lock-limit-job', { i: 1 }),
					agenda.now('lock-limit-job', { i: 2 })
				]);

				// Wait for the process interval to pick up the jobs
				await delay(500);

				expect((await agenda.getRunningStats()).lockedJobs).toBe(1);
			});

			it('should not lock more mixed jobs than agenda lockLimit', async () => {
				agenda.lockLimit(1);
				agenda.processEvery(100);

				agenda.define('lock-mixed-1', (_job, _cb) => {});
				agenda.define('lock-mixed-2', (_job, _cb) => {});
				agenda.define('lock-mixed-3', (_job, _cb) => {});

				await agenda.start();

				await Promise.all([
					agenda.now('lock-mixed-1', { i: 1 }),
					agenda.now('lock-mixed-2', { i: 2 }),
					agenda.now('lock-mixed-3', { i: 3 })
				]);

				await delay(500);
				expect((await agenda.getRunningStats()).lockedJobs).toBe(1);
			});

			it('should not lock more than definition lockLimit jobs', async () => {
				agenda.processEvery(100);
				agenda.define('def-lock-limit', (_job, _cb) => {}, { lockLimit: 1 });

				await agenda.start();

				await Promise.all([
					agenda.now('def-lock-limit', { i: 1 }),
					agenda.now('def-lock-limit', { i: 2 })
				]);

				await delay(500);
				expect((await agenda.getRunningStats()).lockedJobs).toBe(1);
			});

			it('should not lock more than agenda lockLimit during processing interval', async () => {
				agenda.lockLimit(1);
				agenda.processEvery(200);

				agenda.define('lock-interval', (_job, _cb) => {});

				await agenda.start();

				const when = new Date(Date.now() + 300);

				await Promise.all([
					agenda.schedule(when, 'lock-interval', { i: 1 }),
					agenda.schedule(when, 'lock-interval', { i: 2 })
				]);

				await delay(600);
				expect((await agenda.getRunningStats()).lockedJobs).toBe(1);
			});

			it('should not lock more than definition lockLimit during processing interval', async () => {
				agenda.processEvery(200);
				agenda.define('def-lock-interval', (_job, _cb) => {}, { lockLimit: 1 });

				await agenda.start();

				const when = new Date(Date.now() + 300);

				await Promise.all([
					agenda.schedule(when, 'def-lock-interval', { i: 1 }),
					agenda.schedule(when, 'def-lock-interval', { i: 2 })
				]);

				await delay(600);
				expect((await agenda.getRunningStats()).lockedJobs).toBe(1);
			});
		});

		// Note: getRunningStats tests are in jobprocessor-test-suite.ts (more comprehensive)

		describe('purge', () => {
			it('should remove orphaned jobs (jobs without definitions)', async () => {
				// Define and create jobs that should be KEPT
				agenda.define('defined-job', jobProcessor);
				await agenda.now('defined-job');

				// Create orphaned jobs directly in DB (no definition)
				// We need to temporarily define them to create, then "orphan" them
				agenda.define('orphan-1', jobProcessor);
				agenda.define('orphan-2', jobProcessor);
				await agenda.now('orphan-1');
				await agenda.now('orphan-2');

				// Remove the definitions to make them orphans
				delete agenda.definitions['orphan-1'];
				delete agenda.definitions['orphan-2'];

				const beforePurge = await agenda.queryJobs({});
				expect(beforePurge.total).toBe(3);

				// Purge should only remove orphaned jobs (not defined)
				const purged = await agenda.purge();
				expect(purged).toBe(2);

				const afterPurge = await agenda.queryJobs({});
				expect(afterPurge.total).toBe(1);
				expect(afterPurge.jobs[0].name).toBe('defined-job');
			});
		});

		describe('unique constraint', () => {
			it('should modify one job when unique matches', async () => {
				const job1 = await agenda
					.create('unique-job', {
						type: 'active',
						userId: '123',
						other: true
					})
					.unique({
						'data.type': 'active',
						'data.userId': '123'
					})
					.schedule('now')
					.save();

				const job2 = await agenda
					.create('unique-job', {
						type: 'active',
						userId: '123',
						other: false
					})
					.unique({
						'data.type': 'active',
						'data.userId': '123'
					})
					.schedule('now')
					.save();

				// Both should have the same ID (upserted)
				expect(job1.attrs._id?.toString()).toBe(job2.attrs._id?.toString());

				const result = await agenda.queryJobs({ name: 'unique-job' });
				expect(result.jobs.length).toBe(1);
			});

			it('should not modify job when unique matches and insertOnly is set', async () => {
				const job1 = await agenda
					.create('unique-insert-only', {
						type: 'active',
						userId: '123',
						value: 'first'
					})
					.unique(
						{
							'data.type': 'active',
							'data.userId': '123'
						},
						{ insertOnly: true }
					)
					.schedule('now')
					.save();

				const job2 = await agenda
					.create('unique-insert-only', {
						type: 'active',
						userId: '123',
						value: 'second'
					})
					.unique(
						{
							'data.type': 'active',
							'data.userId': '123'
						},
						{ insertOnly: true }
					)
					.schedule('now')
					.save();

				// Same ID but data should not be updated
				expect(job1.attrs._id?.toString()).toBe(job2.attrs._id?.toString());

				const result = await agenda.queryJobs({ name: 'unique-insert-only' });
				expect(result.jobs.length).toBe(1);
				// Original value should be preserved
				expect((result.jobs[0].data as { value: string }).value).toBe('first');
			});

			it('should create two jobs when unique does not match', async () => {
				await agenda
					.create('unique-no-match', {
						type: 'active',
						userId: '123'
					})
					.unique({
						'data.type': 'active',
						'data.userId': '123'
					})
					.schedule('now')
					.save();

				await agenda
					.create('unique-no-match', {
						type: 'active',
						userId: '456' // Different userId
					})
					.unique({
						'data.type': 'active',
						'data.userId': '456'
					})
					.schedule('now')
					.save();

				const result = await agenda.queryJobs({ name: 'unique-no-match' });
				expect(result.jobs.length).toBe(2);
			});
		});

		describe('Job class', () => {
			describe('toJson', () => {
				it('should return job attributes as JSON', async () => {
					const job = await agenda.now('json-test', { foo: 'bar' });
					const json = job.toJson();

					expect(json.name).toBe('json-test');
					expect(json.data).toEqual({ foo: 'bar' });
					expect(json._id).toBeDefined();
				});
			});

			describe('repeatEvery', () => {
				it('should set repeatInterval', async () => {
					const job = agenda.create('repeat-every-test');
					job.repeatEvery('5 minutes');

					expect(job.attrs.repeatInterval).toBe('5 minutes');
				});

				it('should accept cron expression', async () => {
					const job = agenda.create('repeat-cron-test');
					job.repeatEvery('0 6 * * *');

					expect(job.attrs.repeatInterval).toBe('0 6 * * *');
				});

				it('should clear repeatInterval when set to null', async () => {
					agenda.define('repeat-clear-test', jobProcessor);
					const job = await agenda.create('repeat-clear-test');
					job.repeatEvery('5 minutes');
					await job.save();
					expect(job.attrs.repeatInterval).toBe('5 minutes');

					job.repeatEvery('');
					await job.save();
					expect(job.attrs.repeatInterval).toBe('');
				});
			});

			describe('repeatAt', () => {
				it('should set repeatAt time', async () => {
					const job = agenda.create('repeat-at-test');
					job.repeatAt('3:30pm');

					expect(job.attrs.repeatAt).toBe('3:30pm');
				});
			});

			describe('schedule', () => {
				it('should set nextRunAt from Date', async () => {
					const job = agenda.create('schedule-date-test');
					const when = new Date(Date.now() + 60000);
					job.schedule(when);

					expect(job.attrs.nextRunAt?.getTime()).toBe(when.getTime());
				});

				it('should set nextRunAt from string', async () => {
					const job = agenda.create('schedule-string-test');
					job.schedule('in 5 minutes');

					expect(job.attrs.nextRunAt).toBeDefined();
					expect(job.attrs.nextRunAt!.getTime()).toBeGreaterThan(Date.now());
				});
			});

			describe('priority', () => {
				it('should set priority number', async () => {
					const job = agenda.create('priority-num-test');
					job.priority(10);

					expect(job.attrs.priority).toBe(10);
				});

				it('should parse priority string', async () => {
					const job = agenda.create('priority-str-test');
					job.priority('high');

					expect(job.attrs.priority).toBe(10);
				});

				it('should support negative priority', async () => {
					const job = agenda.create('priority-neg-test');
					job.priority(-5);

					expect(job.attrs.priority).toBe(-5);
				});
			});

			describe('remove', () => {
				it('should remove job from database', async () => {
					const job = await agenda.now('remove-test');
					const id = job.attrs._id;

					await job.remove();

					const result = await agenda.queryJobs({ id: id?.toString() });
					expect(result.jobs.length).toBe(0);
				});
			});

			describe('run', () => {
				it('should call the job processor directly', async () => {
					let called = false;
					agenda.define('run-direct-test', async () => {
						called = true;
					});

					const job = agenda.create('run-direct-test');
					await job.save(); // Save first to get an ID
					await job.run();

					expect(called).toBe(true);
				});

				it('should pass the job instance to the processor', async () => {
					let receivedJob: Job | undefined;
					agenda.define('run-job-instance-test', async (j: Job) => {
						receivedJob = j;
					});

					const job = agenda.create('run-job-instance-test', { foo: 'bar' });
					await job.save(); // Save first to get an ID
					await job.run();

					expect(receivedJob).toBeDefined();
					expect(receivedJob?.attrs.data).toEqual({ foo: 'bar' });
				});
			});

			describe('touch', () => {
				it('should update lockedAt', async () => {
					let touchedLockedAt: Date | undefined;
					let initialLockedAt: Date | undefined;

					agenda.define('touch-test', async (job: Job) => {
						initialLockedAt = job.attrs.lockedAt;
						await new Promise(resolve => setTimeout(resolve, 50));
						await job.touch();
						touchedLockedAt = job.attrs.lockedAt;
					});

					await agenda.start();
					await agenda.now('touch-test');

					await waitForEvent(agenda, 'complete:touch-test');
					expect(initialLockedAt).toBeDefined();
					expect(touchedLockedAt).toBeDefined();
					expect(touchedLockedAt!.getTime()).toBeGreaterThan(initialLockedAt!.getTime());
				});

				it('should persist progress value', async () => {
					let jobId: string | undefined;

					agenda.define('touch-progress-test', async (job: Job) => {
						jobId = job.attrs._id?.toString();
						await job.touch(50);
						expect(job.attrs.progress).toBe(50);
					});

					await agenda.start();
					await agenda.now('touch-progress-test');

					await waitForEvent(agenda, 'complete:touch-progress-test');
					expect(jobId).toBeDefined();

					const result = await agenda.queryJobs({ id: jobId });
					expect(result.jobs[0].progress).toBe(50);
				});
			});

			describe('fail', () => {
				it('should set failure fields in memory', async () => {
					const job = await agenda.now('fail-mark-test');
					job.fail(new Error('Test failure'));

					// fail() sets the in-memory attrs
					expect(job.attrs.failReason).toBe('Test failure');
					expect(job.attrs.failedAt).toBeDefined();
					expect(job.attrs.failCount).toBe(1);
				});

				it('should increment failCount on multiple failures', async () => {
					const job = await agenda.now('fail-count-test');
					job.fail(new Error('First failure'));
					job.fail(new Error('Second failure'));

					expect(job.attrs.failCount).toBe(2);
					expect(job.attrs.failReason).toBe('Second failure');
				});
			});

			describe('save', () => {
				it('should persist job to database', async () => {
					const job = agenda.create('save-test', { value: 42 });
					await job.save();

					expect(job.attrs._id).toBeDefined();

					const result = await agenda.queryJobs({ name: 'save-test' });
					expect(result.jobs.length).toBe(1);
					expect((result.jobs[0].data as { value: number }).value).toBe(42);
				});

				it('should update existing job', async () => {
					const job = await agenda.now('save-update-test', { value: 1 });
					job.attrs.data = { value: 2 };
					await job.save();

					const result = await agenda.queryJobs({ name: 'save-update-test' });
					expect(result.jobs.length).toBe(1);
					expect((result.jobs[0].data as { value: number }).value).toBe(2);
				});

				it('should return the job', async () => {
					const job = agenda.create('save-return-test');
					const result = await job.save();
					expect(result).toBe(job);
				});
			});
		});

		describe('async/callback job handling', () => {
			it('should allow async functions', async () => {
				let finished = false;
				let successCalled = false;

				agenda.define('async-job', async () => {
					await delay(5);
					finished = true;
				});

				agenda.once('success:async-job', () => {
					successCalled = true;
				});

				const job = agenda.create('async-job');
				await job.save();

				expect(finished).toBe(false);
				await job.run();
				expect(successCalled).toBe(true);
				expect(finished).toBe(true);
			});

			it('should handle errors from async functions', async () => {
				let failCalled = false;
				let failError: Error | undefined;
				const err = new Error('async failure');

				agenda.define('async-fail-job', async () => {
					await delay(5);
					throw err;
				});

				agenda.once('fail:async-fail-job', (error: Error) => {
					failCalled = true;
					failError = error;
				});

				const job = agenda.create('async-fail-job');
				await job.save();
				await job.run();

				expect(failCalled).toBe(true);
				expect(failError?.message).toBe('async failure');
			});

			it('should wait for callback even if function is async', async () => {
				let finishedCb = false;
				let successCalled = false;

				agenda.define('async-cb-job', async (_job, cb) => {
					(async () => {
						await delay(5);
						finishedCb = true;
						cb();
					})();
				});

				agenda.once('success:async-cb-job', () => {
					successCalled = true;
				});

				const job = agenda.create('async-cb-job');
				await job.save();
				await job.run();

				expect(finishedCb).toBe(true);
				expect(successCalled).toBe(true);
			});

			it('should use callback error if async function did not reject', async () => {
				let failCalled = false;
				let failError: Error | undefined;
				const err = new Error('callback failure');

				agenda.define('async-cb-error-job', async (_job, cb) => {
					(async () => {
						await delay(5);
						cb(err);
					})();
				});

				agenda.once('fail:async-cb-error-job', (error: Error) => {
					failCalled = true;
					failError = error;
				});

				const job = agenda.create('async-cb-error-job');
				await job.save();
				await job.run();

				expect(failCalled).toBe(true);
				expect(failError?.message).toBe('callback failure');
			});

			it('should favor async error over callback error if async comes first', async () => {
				let failCalled = false;
				let failError: Error | undefined;
				const fnErr = new Error('functionFailure');
				const cbErr = new Error('callbackFailure');

				agenda.define('async-first-error-job', async (_job, cb) => {
					(async () => {
						await delay(5);
						cb(cbErr);
					})();
					throw fnErr;
				});

				agenda.on('fail:async-first-error-job', (error: Error) => {
					failCalled = true;
					failError = error;
				});

				const job = agenda.create('async-first-error-job');
				await job.save();
				await job.run();

				expect(failCalled).toBe(true);
				expect(failError?.message).toBe('functionFailure');
			});

			it('should favor callback error over async error if callback comes first', async () => {
				let failCalled = false;
				let failError: Error | undefined;
				const fnErr = new Error('functionFailure');
				const cbErr = new Error('callbackFailure');

				agenda.define('cb-first-error-job', async (_job, cb) => {
					cb(cbErr);
					await delay(5);
					throw fnErr;
				});

				agenda.on('fail:cb-first-error-job', (error: Error) => {
					failCalled = true;
					failError = error;
				});

				const job = agenda.create('cb-first-error-job');
				await job.save();
				await job.run();

				expect(failCalled).toBe(true);
				expect(failError?.message).toBe('callbackFailure');
			});
		});

		describe('events', () => {
			it('should emit start event when job begins', async () => {
				let startEmitted = false;
				agenda.define('start-event-test', async () => {});

				agenda.on('start:start-event-test', () => {
					startEmitted = true;
				});

				await agenda.start();
				await agenda.now('start-event-test');

				await waitForEvent(agenda, 'complete:start-event-test');
				expect(startEmitted).toBe(true);
			});

			it('should emit complete event when job finishes', async () => {
				let completeEmitted = false;
				agenda.define('complete-event-test', async () => {});

				agenda.on('complete:complete-event-test', () => {
					completeEmitted = true;
				});

				await agenda.start();
				await agenda.now('complete-event-test');

				await waitForEvent(agenda, 'complete:complete-event-test');
				expect(completeEmitted).toBe(true);
			});

			it('should emit generic start event', async () => {
				let genericStartEmitted = false;
				agenda.define('generic-start-test', async () => {});

				agenda.on('start', () => {
					genericStartEmitted = true;
				});

				await agenda.start();
				await agenda.now('generic-start-test');

				await waitForEvent(agenda, 'complete:generic-start-test');
				expect(genericStartEmitted).toBe(true);
			});
		});

		describe('drain', () => {
			it('should wait for all running jobs to complete', async () => {
				const completedJobs: string[] = [];

				agenda.define('drain-test', async (job: Job) => {
					await new Promise(resolve => setTimeout(resolve, 200));
					completedJobs.push(job.attrs._id?.toString() || 'unknown');
				});

				await agenda.start();

				// Schedule multiple jobs
				await Promise.all([
					agenda.now('drain-test'),
					agenda.now('drain-test'),
					agenda.now('drain-test')
				]);

				// Wait for at least one job to start (processEvery is 100ms)
				await waitForEvent(agenda, 'start:drain-test');

				// Drain should wait for all to complete
				await agenda.drain();

				expect(completedJobs.length).toBe(3);
			});

			it('should wait for running job to finish', async () => {
				let jobStarted = false;
				let jobFinished = false;

				agenda.define('drainWaitJob', async () => {
					jobStarted = true;
					await new Promise(resolve => setTimeout(resolve, 300));
					jobFinished = true;
				});

				await agenda.start();
				await agenda.now('drainWaitJob');

				// Wait for job to actually start
				await waitForEvent(agenda, 'start:drainWaitJob');
				expect(jobStarted).toBe(true);
				expect(jobFinished).toBe(false);

				// Call drain - should wait for job to complete
				await agenda.drain();
				expect(jobFinished).toBe(true);
			});

			it('should resolve immediately if no jobs are running', async () => {
				await agenda.start();
				// No jobs scheduled, drain should resolve immediately
				await agenda.drain();
				// If we get here, the test passes
			});
		});

		describe('stop', () => {
			it('should stop agenda', async () => {
				await agenda.start();
				await agenda.stop();
				// Agenda should be stopped after stop - if we get here, it worked
			});
		});

		describe('repeating jobs', () => {
			it('should reschedule job after completion when using repeatEvery', async () => {
				let runCount = 0;
				agenda.define('repeat-test', async () => {
					runCount++;
				});

				// Use 1 second interval (humanInterval recognizes "1 second")
				await agenda.every('1 second', 'repeat-test');
				await agenda.start();

				// Wait for multiple runs (need >2 seconds for 2+ runs with 1 second interval)
				await new Promise(resolve => setTimeout(resolve, 2500));

				await agenda.stop();
				expect(runCount).toBeGreaterThanOrEqual(2);
			});

			it('should run job at scheduled cron time', async () => {
				let processed = false;
				agenda.define('cron-test', async () => {
					processed = true;
				});

				// Schedule to run every second
				await agenda.every('* * * * * *', 'cron-test');
				await agenda.start();

				await waitForEvent(agenda, 'complete:cron-test', 3000);
				expect(processed).toBe(true);
			});
		});

		describe('error handling', () => {
			it('should emit error event when job throws', async () => {
				let errorEmitted = false;
				let errorJob: Job | undefined;

				agenda.define('error-test', async () => {
					throw new Error('Job error');
				});

				agenda.on('fail:error-test', (err: Error, job: Job) => {
					errorEmitted = true;
					errorJob = job;
				});

				await agenda.start();
				await agenda.now('error-test');

				await waitForEvent(agenda, 'complete:error-test');
				expect(errorEmitted).toBe(true);
				expect(errorJob?.attrs.name).toBe('error-test');
			});

			it('should save failReason and failedAt when job fails', async () => {
				agenda.define('fail-save-test', async () => {
					throw new Error('Failure reason');
				});

				await agenda.start();
				await agenda.now('fail-save-test');

				await waitForEvent(agenda, 'complete:fail-save-test');

				const result = await agenda.queryJobs({ name: 'fail-save-test' });
				expect(result.jobs[0].failReason).toBe('Failure reason');
				expect(result.jobs[0].failedAt).toBeDefined();
			});

			it('should increment failCount on repeated failures', async () => {
				agenda.define('fail-count-test', async () => {
					throw new Error('Repeated failure');
				});
				// The fail event emits (error, job), so second param is the job
				agenda.on('fail:fail-count-test', (_err, job) => {
					job.attrs.nextRunAt = new Date();
				});

				await agenda.start();
				await agenda.now('fail-count-test');

				// Wait for 2 failures (give enough time for job pickup and retries)
				await Promise.all([
					waitForEvents(agenda, 'fail:fail-count-test', 2, 10000), // fail is called before we save hte result to the db
					waitForEvents(agenda, 'complete:fail-count-test', 2, 10000) // therefore we also wait for complete events (emitted after the db commit)
				]);

				const result = await agenda.queryJobs({ name: 'fail-count-test' });
				expect(result.jobs[0].failCount).toBeGreaterThanOrEqual(2);
			});

			it('should not run failed jobs again unless rescheduled', async () => {
				let runCount = 0;

				agenda.define('no-rerun-failed', async () => {
					runCount++;
					throw new Error('Intentional failure');
				});

				await agenda.start();
				await agenda.now('no-rerun-failed');

				await waitForEvent(agenda, 'fail:no-rerun-failed');

				// Wait a bit to ensure job is not rerun
				await new Promise(resolve => setTimeout(resolve, 500));

				expect(runCount).toBe(1);

				// Verify job still exists but has no nextRunAt (won't run again)
				const result = await agenda.queryJobs({ name: 'no-rerun-failed' });
				expect(result.jobs.length).toBe(1);
				expect(result.jobs[0].failReason).toBe('Intentional failure');
				// nextRunAt should be null/undefined after failure (job is done, not rescheduled)
				expect(result.jobs[0].nextRunAt).toBeFalsy();
			});

			it('should not cause unhandled promise rejection on job timeout', async () => {
				const unhandledRejections: Error[] = [];
				const rejectionHandler = (err: Error) => {
					console.error('unhandledRejection', err);
					unhandledRejections.push(err);
				};
				process.on('unhandledRejection', rejectionHandler);

				try {
					agenda.define(
						'timeout-test',
						async () => {
							// Job runs longer than lockLifetime
							await new Promise(resolve => setTimeout(resolve, 500));
						},
						{ lockLifetime: 100 } // Very short lock lifetime
					);

					agenda.on('error', (_err) => {
						// err handler is required
					})
					await agenda.start();
					await agenda.now('timeout-test');

					// Wait for job to start and potentially timeout
					await waitForEvent(agenda, 'start:timeout-test');
					await new Promise(resolve => setTimeout(resolve, 700));

					// Check no unhandled rejections occurred
					expect(unhandledRejections.length).toBe(0);
				} finally {
					process.off('unhandledRejection', rejectionHandler);
				}
			});
		});

		// Notification channel integration tests - only run if channel is provided
		if (config.createNotificationChannel) {
			describe('notification channel integration', () => {
				let notificationChannel: NotificationChannel;
				let agendaWithChannel: Agenda;

				beforeEach(async () => {
					if (config.createNotificationChannel) {
						notificationChannel = await config.createNotificationChannel();
					}
				});

				afterEach(async () => {
					if (agendaWithChannel) {
						await agendaWithChannel.stop();
					}
					if (config.cleanupNotificationChannel && notificationChannel) {
						await config.cleanupNotificationChannel(notificationChannel);
					}
				});

				it('should accept notification channel in constructor', async () => {
					agendaWithChannel = new Agenda({
						backend,
						notificationChannel
					});

					expect(agendaWithChannel.hasNotificationChannel()).toBe(true);
				});

				it('should accept notification channel via notifyVia method', async () => {
					agendaWithChannel = new Agenda({ backend });
					expect(agendaWithChannel.hasNotificationChannel()).toBe(false);

					agendaWithChannel.notifyVia(notificationChannel);
					expect(agendaWithChannel.hasNotificationChannel()).toBe(true);
				});

				it('should throw when setting notification channel after start', async () => {
					agendaWithChannel = new Agenda({ backend });
					agendaWithChannel.define('test', async () => {});
					await agendaWithChannel.start();

					expect(() => {
						agendaWithChannel.notifyVia(notificationChannel);
					}).toThrow(/already running/i);
				});

				it('should connect and disconnect notification channel on start/stop', async () => {
					agendaWithChannel = new Agenda({
						backend,
						notificationChannel
					});

					expect(notificationChannel.state).toBe('disconnected');

					agendaWithChannel.define('test', async () => {});
					await agendaWithChannel.start();

					expect(notificationChannel.state).toBe('connected');

					await agendaWithChannel.stop();

					expect(notificationChannel.state).toBe('disconnected');
				});

				it('should process jobs faster with notification channel', async () => {
					let jobProcessed = false;

					// Create agenda with long processEvery but with notification channel
					agendaWithChannel = new Agenda({
						backend,
						processEvery: 10000, // 10 seconds - way longer than our test
						notificationChannel
					});
					await agendaWithChannel.ready;

					agendaWithChannel.define('fast-job', async () => {
						jobProcessed = true;
					});

					await agendaWithChannel.start();

					// Schedule a job - notification should trigger immediate processing
					await agendaWithChannel.now('fast-job');

					// Wait a short time for notification-based processing
					await new Promise(resolve => setTimeout(resolve, 500));

					expect(jobProcessed).toBe(true);
				});
			});
		}

		// Fork mode tests - skip if configured to skip or if forkHelper is not provided
		if (!config.skip?.forkMode && config.forkHelper) {
			describe('fork mode', () => {
				it('should run a job in fork mode', async () => {
					const agendaFork = new Agenda({
						backend,
						forkHelper: config.forkHelper
					});
					await agendaFork.ready;

					expect(agendaFork.forkHelper?.path).toBe(config.forkHelper!.path);

					const job = agendaFork.create('some job');
					job.forkMode(true);
					job.schedule('now');
					await job.save();

					const jobData = await backend.repository.getJobById(job.attrs._id!);
					expect(jobData).toBeDefined();
					expect(jobData?.fork).toBe(true);

					// Initialize job definition
					someJobDefinition(agendaFork);

					await agendaFork.start();

					do {
						await delay(50);
					} while (await job.isRunning());

					const jobDataFinished = await backend.repository.getJobById(job.attrs._id!);
					expect(jobDataFinished?.lastFinishedAt).toBeDefined();
					expect(jobDataFinished?.failReason).toBeUndefined();
					expect(jobDataFinished?.failCount).toBeUndefined();

					await agendaFork.stop();
				});

				it('should handle job failure in fork mode', async () => {
					const agendaFork = new Agenda({
						backend,
						forkHelper: config.forkHelper
					});
					await agendaFork.ready;

					const job = agendaFork.create('some job', { failIt: 'error' });
					job.forkMode(true);
					job.schedule('now');
					await job.save();

					const jobData = await backend.repository.getJobById(job.attrs._id!);
					expect(jobData).toBeDefined();
					expect(jobData?.fork).toBe(true);

					// Initialize job definition
					someJobDefinition(agendaFork);

					await agendaFork.start();

					do {
						await delay(50);
					} while (await job.isRunning());

					const jobDataFinished = await backend.repository.getJobById(job.attrs._id!);
					expect(jobDataFinished?.lastFinishedAt).toBeDefined();
					expect(jobDataFinished?.failReason).not.toBeUndefined();
					expect(jobDataFinished?.failCount).toBe(1);

					await agendaFork.stop();
				});

				it('should handle process exit in fork mode', async () => {
					const agendaFork = new Agenda({
						backend,
						forkHelper: config.forkHelper
					});
					await agendaFork.ready;

					const job = agendaFork.create('some job', { failIt: 'die' });
					job.forkMode(true);
					job.schedule('now');
					await job.save();

					const jobData = await backend.repository.getJobById(job.attrs._id!);
					expect(jobData).toBeDefined();
					expect(jobData?.fork).toBe(true);

					// Initialize job definition
					someJobDefinition(agendaFork);

					await agendaFork.start();

					do {
						await delay(50);
					} while (await job.isRunning());

					const jobDataFinished = await backend.repository.getJobById(job.attrs._id!);
					expect(jobDataFinished?.lastFinishedAt).toBeDefined();
					expect(jobDataFinished?.failReason).not.toBeUndefined();
					expect(jobDataFinished?.failCount).toBe(1);

					await agendaFork.stop();
				});
			});
		}
	});
}
