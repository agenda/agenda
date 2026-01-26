/**
 * Retry test factory
 *
 * This file exports a test factory for job retry tests.
 *
 * Usage:
 * ```typescript
 * import { retryTestSuite } from 'agenda/test/retry.test';
 *
 * retryTestSuite({
 *   name: 'Retry with MongoDB',
 *   createBackend: async () => new MongoBackend({ mongo: db }),
 *   cleanupBackend: async (backend) => await backend.disconnect(),
 *   clearJobs: async (backend) => await db.collection('agendaJobs').deleteMany({})
 * });
 * ```
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import type { IAgendaBackend } from '../../src';
import { Agenda } from '../../src';
import { delay } from './test-utils.js';

export interface RetryTestConfig {
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
 * Retry tests
 */
export function retryTestSuite(config: RetryTestConfig): void {
	describe(`${config.name} - Retry`, () => {
		let backend: IAgendaBackend;
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

		it('should retry a job', { timeout: 100000 }, async () => {
			let shouldFail = true;

			agenda.define('a job', (_job, done) => {
				if (shouldFail) {
					shouldFail = false;
					return done(new Error('test failure'));
				}

				done();
				return undefined;
			});

			agenda.on('fail:a job', (err, job) => {
				if (err) {
					// Do nothing as this is expected to fail.
				}

				job.schedule('now').save();
			});

			const successPromise = new Promise(resolve => {
				agenda.on('success:a job', resolve);
			});

			await agenda.now('a job');

			await agenda.start();
			await successPromise;
		});

		it('should track failCount on retry', async () => {
			let attempts = 0;

			agenda.define('failing-job', async () => {
				attempts++;
				if (attempts < 3) {
					throw new Error(`Attempt ${attempts} failed`);
				}
			});

			agenda.on('fail:failing-job', (_err, job) => {
				// Retry immediately
				job.schedule('now').save();
			});

			const successPromise = new Promise(resolve => {
				agenda.on('success:failing-job', resolve);
			});

			await agenda.now('failing-job');
			await agenda.start();
			await successPromise;

			expect(attempts).toBe(3);
		});
	});
}

// Export for use in shared index
export type { RetryTestConfig };