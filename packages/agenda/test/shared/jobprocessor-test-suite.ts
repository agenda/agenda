/**
 * JobProcessor test factory
 *
 * This file exports a test factory for JobProcessor-specific tests.
 *
 * Usage:
 * ```typescript
 * import { jobProcessorTestSuite } from 'agenda/test/jobprocessor.test';
 *
 * jobProcessorTestSuite({
 *   name: 'JobProcessor with MongoDB',
 *   createBackend: async () => new MongoBackend({ mongo: db }),
 *   cleanupBackend: async (backend) => await backend.disconnect(),
 *   clearJobs: async (backend) => await db.collection('agendaJobs').deleteMany({})
 * });
 * ```
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import type { IAgendaBackend } from '../../src/index.js';
import { Agenda } from '../../src/index.js';
import { delay } from './test-utils.js';

export interface JobProcessorTestConfig {
	/** Name for the test suite */
	name: string;
	/** Factory to create a fresh backend instance */
	createBackend: () => Promise<IAgendaBackend>;
	/** Cleanup function called after tests */
	cleanupBackend: (backend: IAgendaBackend) => Promise<void>;
	/** Clear all jobs between tests */
	clearJobs: (backend: IAgendaBackend) => Promise<void>;
}

/**
 * JobProcessor tests
 */
export function jobProcessorTestSuite(config: JobProcessorTestConfig): void {
	describe(`${config.name} - JobProcessor`, () => {
		let backend: IAgendaBackend;
		let agenda: Agenda;

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
				maxConcurrency: 4,
				defaultConcurrency: 1,
				lockLimit: 15,
				defaultLockLimit: 6,
				processEvery: 100,
				name: 'agendaTest'
			});
			await agenda.ready;
		});

		afterEach(async () => {
			if (agenda) {
				await agenda.stop();
			}
			await config.clearJobs(backend);
		});

		describe('getRunningStats', () => {
			it('throws an error when agenda is not running', async () => {
				await expect(agenda.getRunningStats()).rejects.toThrow('agenda not running!');
			});

			it('contains the agendaVersion', async () => {
				await agenda.start();

				const status = await agenda.getRunningStats();
				expect(status).toHaveProperty('version');
				expect(status.version).toMatch(/\d+\.\d+\.\d+/);
			});

			it('shows the correct job status', async () => {
				agenda.define('test', async () => {
					await delay(30000);
				});

				agenda.now('test');
				await agenda.start();

				await new Promise(resolve => {
					agenda.on('start:test', resolve);
				});

				const status = await agenda.getRunningStats();
				expect(status).toHaveProperty('jobStatus');
				if (status.jobStatus) {
					expect(status.jobStatus).toHaveProperty('test');
					expect(status.jobStatus.test.locked).toBe(1);
					expect(status.jobStatus.test.running).toBe(1);
					expect(status.jobStatus.test.config.fn).toBeTypeOf('function');
					expect(status.jobStatus.test.config.concurrency).toBe(1);
					expect(status.jobStatus.test.config.lockLifetime).toBe(600000);
					expect(status.jobStatus.test.config.priority).toBe(0);
					expect(status.jobStatus.test.config.lockLimit).toBe(6);
				}
			});

			it('shows queueName', async () => {
				await agenda.start();

				const status = await agenda.getRunningStats();
				expect(status).toHaveProperty('queueName');
				expect(status.queueName).toBeTypeOf('string');
				expect(status.queueName).toBe('agendaTest');
			});

			it('shows totalQueueSizeDB', async () => {
				await agenda.start();

				const status = await agenda.getRunningStats();
				expect(status).toHaveProperty('totalQueueSizeDB');
				expect(status.totalQueueSizeDB).toBeTypeOf('number');
				expect(status.totalQueueSizeDB).toBe(0);
			});
		});

		it('ensure new jobs are always filling up running queue', async () => {
			let shortOneFinished = false;

			agenda.define('test long', async () => {
				await delay(1000);
			});
			agenda.define('test short', async () => {
				shortOneFinished = true;
				await delay(5);
			});

			await agenda.start();

			// queue up long ones
			for (let i = 0; i < 100; i += 1) {
				agenda.now('test long');
			}

			await delay(1500);

			// queue more short ones (they will be picked up on next process interval)
			for (let j = 0; j < 100; j += 1) {
				agenda.now('test short');
			}

			// Wait for the next process interval to pick up and run the short jobs
			await delay(2000);

			expect(shortOneFinished).toBe(true);
		});

		it('ensure slow jobs time out', async () => {
			let jobStarted = false;
			agenda.define(
				'test long',
				async () => {
					jobStarted = true;
					await delay(2500);
				},
				{ lockLifetime: 500 }
			);

			// queue up long ones
			agenda.now('test long');

			await agenda.start();

			const promiseResult = await new Promise<Error | void>(resolve => {
				agenda.on('error', err => {
					resolve(err);
				});

				agenda.on('success', () => {
					resolve();
				});
			});

			expect(jobStarted).toBe(true);
			expect(promiseResult).toBeInstanceOf(Error);
		});

		it('ensure slow jobs do not time out when calling touch', async () => {
			agenda.define(
				'test long',
				async job => {
					for (let i = 0; i < 10; i += 1) {
						await delay(100);
						await job.touch();
					}
				},
				{ lockLifetime: 500 }
			);

			await agenda.start();

			// queue up long ones
			agenda.now('test long');

			const promiseResult = await new Promise<Error | void>(resolve => {
				agenda.on('error', err => {
					resolve(err);
				});

				agenda.on('success', () => {
					resolve();
				});
			});

			expect(promiseResult).toBeUndefined();
		});

		it('ensure concurrency is filled up', async () => {
			agenda.maxConcurrency(300);
			agenda.lockLimit(150);
			agenda.defaultLockLimit(20);
			agenda.defaultConcurrency(10);

			for (let jobI = 0; jobI < 10; jobI += 1) {
				agenda.define(
					`test job ${jobI}`,
					async () => {
						await delay(5000);
					},
					{ lockLifetime: 10000 }
				);
			}

			// queue up jobs
			for (let jobI = 0; jobI < 10; jobI += 1) {
				for (let jobJ = 0; jobJ < 25; jobJ += 1) {
					agenda.now(`test job ${jobI}`);
				}
			}

			await agenda.start();

			let runningJobs = 0;
			const allJobsStarted = (async () => {
				do {
					runningJobs = (await agenda.getRunningStats()).runningJobs as number;
					await delay(50);
				} while (runningJobs < 90);
				return 'all started';
			})();

			const result = await Promise.race([
				allJobsStarted,
				new Promise(resolve => {
					setTimeout(
						() => resolve(`not all jobs started, currently running: ${runningJobs}`),
						1500
					);
				})
			]);

			expect(result).toBe('all started');
		});
	});
}

