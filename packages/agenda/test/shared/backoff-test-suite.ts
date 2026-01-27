/**
 * Backoff test factory
 *
 * This file exports a test factory for job backoff/retry tests.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import type { AgendaBackend, RetryDetails, JobWithId } from '../../src/index.js';
import {
	Agenda,
	backoffStrategies,
	constant,
	linear,
	exponential,
	combine,
	when
} from '../../src/index.js';

export interface BackoffTestConfig {
	/** Name for the test suite */
	name: string;
	/** Factory to create a fresh backend instance */
	createBackend: () => Promise<AgendaBackend>;
	/** Cleanup function called after tests */
	cleanupBackend: (backend: AgendaBackend) => Promise<void>;
	/** Clear all jobs between tests */
	clearJobs: (backend: AgendaBackend) => Promise<void>;
}

/**
 * Backoff/Retry tests
 */
export function backoffTestSuite(config: BackoffTestConfig): void {
	describe(`${config.name} - Backoff Strategies`, () => {
		let backend: AgendaBackend;
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
				processEvery: 50 // Fast polling for tests
			});
			await agenda.ready;
		});

		afterEach(async () => {
			if (agenda) {
				await agenda.stop();
			}
			await config.clearJobs(backend);
		});

		describe('constant backoff', () => {
			it('should return the same delay for each attempt', () => {
				const strategy = constant({ delay: 1000, maxRetries: 3 });

				expect(strategy({ attempt: 1, error: new Error('test'), jobName: 'test', jobData: {} })).toBe(1000);
				expect(strategy({ attempt: 2, error: new Error('test'), jobName: 'test', jobData: {} })).toBe(1000);
				expect(strategy({ attempt: 3, error: new Error('test'), jobName: 'test', jobData: {} })).toBe(1000);
				expect(strategy({ attempt: 4, error: new Error('test'), jobName: 'test', jobData: {} })).toBeNull();
			});

			it('should respect maxDelay', () => {
				const strategy = constant({ delay: 5000, maxDelay: 2000, maxRetries: 3 });

				expect(strategy({ attempt: 1, error: new Error('test'), jobName: 'test', jobData: {} })).toBe(2000);
			});
		});

		describe('linear backoff', () => {
			it('should increase delay linearly', () => {
				const strategy = linear({ delay: 1000, increment: 1000, maxRetries: 4 });

				expect(strategy({ attempt: 1, error: new Error('test'), jobName: 'test', jobData: {} })).toBe(1000);
				expect(strategy({ attempt: 2, error: new Error('test'), jobName: 'test', jobData: {} })).toBe(2000);
				expect(strategy({ attempt: 3, error: new Error('test'), jobName: 'test', jobData: {} })).toBe(3000);
				expect(strategy({ attempt: 4, error: new Error('test'), jobName: 'test', jobData: {} })).toBe(4000);
				expect(strategy({ attempt: 5, error: new Error('test'), jobName: 'test', jobData: {} })).toBeNull();
			});

			it('should use delay as default increment', () => {
				const strategy = linear({ delay: 500, maxRetries: 3 });

				expect(strategy({ attempt: 1, error: new Error('test'), jobName: 'test', jobData: {} })).toBe(500);
				expect(strategy({ attempt: 2, error: new Error('test'), jobName: 'test', jobData: {} })).toBe(1000);
				expect(strategy({ attempt: 3, error: new Error('test'), jobName: 'test', jobData: {} })).toBe(1500);
			});

			it('should respect maxDelay', () => {
				const strategy = linear({ delay: 1000, increment: 2000, maxDelay: 3000, maxRetries: 5 });

				expect(strategy({ attempt: 1, error: new Error('test'), jobName: 'test', jobData: {} })).toBe(1000);
				expect(strategy({ attempt: 2, error: new Error('test'), jobName: 'test', jobData: {} })).toBe(3000); // capped
				expect(strategy({ attempt: 3, error: new Error('test'), jobName: 'test', jobData: {} })).toBe(3000); // capped
			});
		});

		describe('exponential backoff', () => {
			it('should increase delay exponentially', () => {
				const strategy = exponential({ delay: 100, factor: 2, maxRetries: 5 });

				expect(strategy({ attempt: 1, error: new Error('test'), jobName: 'test', jobData: {} })).toBe(100);
				expect(strategy({ attempt: 2, error: new Error('test'), jobName: 'test', jobData: {} })).toBe(200);
				expect(strategy({ attempt: 3, error: new Error('test'), jobName: 'test', jobData: {} })).toBe(400);
				expect(strategy({ attempt: 4, error: new Error('test'), jobName: 'test', jobData: {} })).toBe(800);
				expect(strategy({ attempt: 5, error: new Error('test'), jobName: 'test', jobData: {} })).toBe(1600);
				expect(strategy({ attempt: 6, error: new Error('test'), jobName: 'test', jobData: {} })).toBeNull();
			});

			it('should respect maxDelay', () => {
				const strategy = exponential({ delay: 100, factor: 2, maxDelay: 500, maxRetries: 10 });

				expect(strategy({ attempt: 1, error: new Error('test'), jobName: 'test', jobData: {} })).toBe(100);
				expect(strategy({ attempt: 2, error: new Error('test'), jobName: 'test', jobData: {} })).toBe(200);
				expect(strategy({ attempt: 3, error: new Error('test'), jobName: 'test', jobData: {} })).toBe(400);
				expect(strategy({ attempt: 4, error: new Error('test'), jobName: 'test', jobData: {} })).toBe(500); // capped
				expect(strategy({ attempt: 5, error: new Error('test'), jobName: 'test', jobData: {} })).toBe(500); // capped
			});

			it('should apply jitter when configured', () => {
				const strategy = exponential({ delay: 1000, factor: 2, maxRetries: 3, jitter: 0.5 });

				// Run multiple times to check jitter variation
				const results = new Set<number>();
				for (let i = 0; i < 20; i++) {
					const delay = strategy({ attempt: 1, error: new Error('test'), jobName: 'test', jobData: {} });
					if (delay !== null) results.add(delay);
				}

				// With 50% jitter, we should see variation (500-1500 range)
				expect(results.size).toBeGreaterThan(1);

				// All values should be within jitter range
				for (const delay of results) {
					expect(delay).toBeGreaterThanOrEqual(500);
					expect(delay).toBeLessThanOrEqual(1500);
				}
			});
		});

		describe('combine strategy', () => {
			it('should try strategies in sequence', () => {
				const strategy = combine(
					// First 2 attempts: 100ms
					(ctx) => ctx.attempt <= 2 ? 100 : null,
					// Next 2 attempts: use exponential-like custom logic
					// (since exponential counts globally, we need custom logic to handle offset)
					(ctx) => {
						if (ctx.attempt > 4) return null;
						// Exponential from attempt 3 onwards
						const adjustedAttempt = ctx.attempt - 2; // 3->1, 4->2
						return 1000 * Math.pow(2, adjustedAttempt - 1);
					}
				);

				expect(strategy({ attempt: 1, error: new Error('test'), jobName: 'test', jobData: {} })).toBe(100);
				expect(strategy({ attempt: 2, error: new Error('test'), jobName: 'test', jobData: {} })).toBe(100);
				expect(strategy({ attempt: 3, error: new Error('test'), jobName: 'test', jobData: {} })).toBe(1000);
				expect(strategy({ attempt: 4, error: new Error('test'), jobName: 'test', jobData: {} })).toBe(2000);
				expect(strategy({ attempt: 5, error: new Error('test'), jobName: 'test', jobData: {} })).toBeNull();
			});
		});

		describe('when (conditional) strategy', () => {
			it('should only retry when condition is met', () => {
				const strategy = when(
					(ctx) => ctx.error.message.includes('timeout'),
					constant({ delay: 1000, maxRetries: 3 })
				);

				const timeoutError = new Error('connection timeout');
				const otherError = new Error('validation failed');

				expect(strategy({ attempt: 1, error: timeoutError, jobName: 'test', jobData: {} })).toBe(1000);
				expect(strategy({ attempt: 1, error: otherError, jobName: 'test', jobData: {} })).toBeNull();
			});
		});

		describe('preset strategies', () => {
			it('aggressive should have fast retries', () => {
				const strategy = backoffStrategies.aggressive();

				expect(strategy({ attempt: 1, error: new Error('test'), jobName: 'test', jobData: {} })).toBe(100);
				expect(strategy({ attempt: 2, error: new Error('test'), jobName: 'test', jobData: {} })).toBe(200);
				expect(strategy({ attempt: 3, error: new Error('test'), jobName: 'test', jobData: {} })).toBe(400);
				expect(strategy({ attempt: 4, error: new Error('test'), jobName: 'test', jobData: {} })).toBeNull();
			});

			it('standard should have balanced retries', () => {
				const strategy = backoffStrategies.standard();

				// First attempt should be around 1000 (with some jitter)
				const delay = strategy({ attempt: 1, error: new Error('test'), jobName: 'test', jobData: {} });
				expect(delay).toBeGreaterThanOrEqual(900);
				expect(delay).toBeLessThanOrEqual(1100);
			});
		});

		describe('auto-retry integration', () => {
			it('should automatically retry with backoff strategy', async () => {
				let attempts = 0;
				const retryDelays: number[] = [];

				agenda.define(
					'auto-retry-job',
					async () => {
						attempts++;
						if (attempts < 3) {
							throw new Error(`Attempt ${attempts} failed`);
						}
					},
					{
						backoff: constant({ delay: 100, maxRetries: 5 })
					}
				);

				agenda.on('retry:auto-retry-job', (_job: JobWithId, details: RetryDetails) => {
					retryDelays.push(details.delay);
				});

				const successPromise = new Promise(resolve => {
					agenda.on('success:auto-retry-job', resolve);
				});

				await agenda.now('auto-retry-job');
				await agenda.start();
				await successPromise;

				expect(attempts).toBe(3);
				expect(retryDelays).toHaveLength(2);
				expect(retryDelays[0]).toBe(100);
				expect(retryDelays[1]).toBe(100);
			});

			it('should emit retry exhausted when max retries reached', async () => {
				let attempts = 0;

				agenda.define(
					'exhausted-job',
					async () => {
						attempts++;
						throw new Error('Always fails');
					},
					{
						backoff: constant({ delay: 50, maxRetries: 2 })
					}
				);

				const exhaustedPromise = new Promise<{ error: Error; job: JobWithId }>(resolve => {
					agenda.on('retry exhausted:exhausted-job', (error: Error, job: JobWithId) => {
						resolve({ error, job });
					});
				});

				await agenda.now('exhausted-job');
				await agenda.start();

				const { error, job } = await exhaustedPromise;

				expect(attempts).toBe(3); // Initial + 2 retries
				expect(error.message).toBe('Always fails');
				expect(job.attrs.failCount).toBe(3);
			});

			it('should provide retry details in event', async () => {
				let retryDetails: RetryDetails | null = null;

				agenda.define(
					'details-job',
					async () => {
						throw new Error('test error');
					},
					{
						backoff: exponential({ delay: 100, maxRetries: 1 })
					}
				);

				agenda.on('retry:details-job', (_job: JobWithId, details: RetryDetails) => {
					retryDetails = details;
				});

				const exhaustedPromise = new Promise(resolve => {
					agenda.on('retry exhausted:details-job', resolve);
				});

				await agenda.now('details-job');
				await agenda.start();
				await exhaustedPromise;

				expect(retryDetails).not.toBeNull();
				expect(retryDetails!.attempt).toBe(1);
				expect(retryDetails!.delay).toBe(100);
				expect(retryDetails!.error.message).toBe('test error');
				expect(retryDetails!.nextRunAt).toBeInstanceOf(Date);
			});

			it('should not auto-retry jobs without backoff configured', { timeout: 5000 }, async () => {
				let attempts = 0;
				let retryCount = 0;

				agenda.define('no-backoff-job', async () => {
					attempts++;
					throw new Error('Always fails');
				});

				agenda.on('retry:no-backoff-job', () => {
					retryCount++;
				});

				const failPromise = new Promise(resolve => {
					agenda.on('fail:no-backoff-job', resolve);
				});

				await agenda.now('no-backoff-job');
				await agenda.start();
				await failPromise;

				// Wait a bit to ensure no retries happen
				await new Promise(r => setTimeout(r, 200));

				expect(attempts).toBe(1);
				expect(retryCount).toBe(0);
			});

			it('should auto-retry repeating jobs when backoff is configured', { timeout: 5000 }, async () => {
				let attempts = 0;
				let retryCount = 0;

				agenda.define(
					'repeating-job',
					async () => {
						attempts++;
						if (attempts === 1) {
							throw new Error('First attempt fails');
						}
					},
					{
						backoff: constant({ delay: 50, maxRetries: 3 })
					}
				);

				agenda.on('retry:repeating-job', () => {
					retryCount++;
				});

				// Use every() which creates a repeating job
				await agenda.every('1 second', 'repeating-job');
				await agenda.start();

				// Wait for job to succeed (after retry)
				await new Promise(resolve => {
					agenda.on('success:repeating-job', resolve);
				});

				// Should have triggered auto-retry since backoff is configured
				expect(retryCount).toBe(1);
				expect(attempts).toBe(2); // First attempt failed, second succeeded
			});

			it('should work with custom backoff function', async () => {
				let attempts = 0;
				const delays: number[] = [];

				agenda.define(
					'custom-backoff-job',
					async () => {
						attempts++;
						if (attempts < 4) {
							throw new Error('Failing');
						}
					},
					{
						backoff: (ctx) => {
							// Custom: fibonacci-like sequence
							if (ctx.attempt > 3) return null;
							const fibDelays = [100, 100, 200];
							return fibDelays[ctx.attempt - 1];
						}
					}
				);

				agenda.on('retry:custom-backoff-job', (_job: JobWithId, details: RetryDetails) => {
					delays.push(details.delay);
				});

				const successPromise = new Promise(resolve => {
					agenda.on('success:custom-backoff-job', resolve);
				});

				await agenda.now('custom-backoff-job');
				await agenda.start();
				await successPromise;

				expect(attempts).toBe(4);
				expect(delays).toEqual([100, 100, 200]);
			});
		});
	});
}
