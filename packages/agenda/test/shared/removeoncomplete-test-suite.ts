/**
 * RemoveOnComplete test factory
 *
 * Tests for the removeOnComplete feature that automatically removes
 * one-time jobs from the database after successful completion.
 *
 * Usage:
 * ```typescript
 * import { removeOnCompleteTestSuite } from 'agenda/test/shared';
 *
 * removeOnCompleteTestSuite({
 *   name: 'RemoveOnComplete with MongoDB',
 *   createBackend: async () => new MongoBackend({ mongo: db }),
 *   cleanupBackend: async (backend) => await backend.disconnect(),
 *   clearJobs: async (backend) => await db.collection('agendaJobs').deleteMany({})
 * });
 * ```
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import type { AgendaBackend } from '../../src/index.js';
import { Agenda } from '../../src/index.js';
import { waitForEvent } from './test-utils.js';

export interface RemoveOnCompleteTestConfig {
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
 * RemoveOnComplete tests
 */
export function removeOnCompleteTestSuite(config: RemoveOnCompleteTestConfig): void {
	describe(`${config.name} - removeOnComplete`, () => {
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
		});

		afterEach(async () => {
			if (agenda) {
				await agenda.stop();
			}
			await config.clearJobs(backend);
		});

		it('should remove one-time job after successful completion when global removeOnComplete is true', async () => {
			agenda = new Agenda({
				backend,
				processEvery: 100,
				removeOnComplete: true
			});
			await agenda.ready;

			agenda.define('removable-job', async () => {
				// job succeeds
			});

			const completePromise = waitForEvent(agenda, 'complete:removable-job');
			await agenda.start();
			await agenda.now('removable-job');
			await completePromise;

			// Give a moment for the async removal to complete
			await new Promise(resolve => setTimeout(resolve, 200));

			const result = await agenda.queryJobs({ name: 'removable-job' });
			expect(result.jobs.length).toBe(0);
		});

		it('should NOT remove one-time job when removeOnComplete is false (default)', async () => {
			agenda = new Agenda({
				backend,
				processEvery: 100
			});
			await agenda.ready;

			agenda.define('kept-job', async () => {
				// job succeeds
			});

			const completePromise = waitForEvent(agenda, 'complete:kept-job');
			await agenda.start();
			await agenda.now('kept-job');
			await completePromise;

			await new Promise(resolve => setTimeout(resolve, 200));

			const result = await agenda.queryJobs({ name: 'kept-job' });
			expect(result.jobs.length).toBe(1);
		});

		it('should NOT remove recurring job even with removeOnComplete true', async () => {
			agenda = new Agenda({
				backend,
				processEvery: 100,
				removeOnComplete: true
			});
			await agenda.ready;

			agenda.define('recurring-job', async () => {
				// job succeeds
			});

			const completePromise = waitForEvent(agenda, 'complete:recurring-job');
			await agenda.start();
			await agenda.every('1 hour', 'recurring-job');
			await completePromise;

			await new Promise(resolve => setTimeout(resolve, 200));

			const result = await agenda.queryJobs({ name: 'recurring-job' });
			expect(result.jobs.length).toBe(1);
		});

		it('should respect per-job removeOnComplete override (true overrides global false)', async () => {
			agenda = new Agenda({
				backend,
				processEvery: 100,
				removeOnComplete: false
			});
			await agenda.ready;

			agenda.define('per-job-remove', async () => {
				// job succeeds
			}, { removeOnComplete: true });

			const completePromise = waitForEvent(agenda, 'complete:per-job-remove');
			await agenda.start();
			await agenda.now('per-job-remove');
			await completePromise;

			await new Promise(resolve => setTimeout(resolve, 200));

			const result = await agenda.queryJobs({ name: 'per-job-remove' });
			expect(result.jobs.length).toBe(0);
		});

		it('should respect per-job removeOnComplete override (false overrides global true)', async () => {
			agenda = new Agenda({
				backend,
				processEvery: 100,
				removeOnComplete: true
			});
			await agenda.ready;

			agenda.define('per-job-keep', async () => {
				// job succeeds
			}, { removeOnComplete: false });

			const completePromise = waitForEvent(agenda, 'complete:per-job-keep');
			await agenda.start();
			await agenda.now('per-job-keep');
			await completePromise;

			await new Promise(resolve => setTimeout(resolve, 200));

			const result = await agenda.queryJobs({ name: 'per-job-keep' });
			expect(result.jobs.length).toBe(1);
		});

		it('should emit complete event before removal', async () => {
			agenda = new Agenda({
				backend,
				processEvery: 100,
				removeOnComplete: true
			});
			await agenda.ready;

			agenda.define('event-before-remove', async () => {
				// job succeeds
			});

			let completeEventFired = false;
			const completePromise = new Promise<void>(resolve => {
				agenda.on('complete:event-before-remove', () => {
					completeEventFired = true;
					resolve();
				});
			});

			await agenda.start();
			await agenda.now('event-before-remove');
			await completePromise;

			expect(completeEventFired).toBe(true);
		});

		it('should NOT remove failed job even with removeOnComplete true', async () => {
			agenda = new Agenda({
				backend,
				processEvery: 100,
				removeOnComplete: true
			});
			await agenda.ready;

			agenda.define('failing-job', async () => {
				throw new Error('intentional failure');
			});

			const failPromise = waitForEvent(agenda, 'fail:failing-job');
			await agenda.start();
			await agenda.now('failing-job');
			await failPromise;

			await new Promise(resolve => setTimeout(resolve, 200));

			const result = await agenda.queryJobs({ name: 'failing-job' });
			expect(result.jobs.length).toBe(1);
		});
	});
}
