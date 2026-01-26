/**
 * Debounce test factory
 *
 * This file exports a test factory for job debounce tests.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import type { AgendaBackend } from '../../src/index.js';
import { Agenda } from '../../src/index.js';

export interface DebounceTestConfig {
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
 * Debounce tests
 */
export function debounceTestSuite(config: DebounceTestConfig): void {
	describe(`${config.name} - Debounce`, () => {
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

		describe('trailing debounce (default)', () => {
			it('should delay job execution by the debounce delay', async () => {
				agenda.define('debounceTest', async () => {});

				const beforeSave = Date.now();
				const job = await agenda
					.create('debounceTest', { key: 'test1' })
					.unique({ 'data.key': 'test1' })
					.debounce(1000)
					.save();

				const afterSave = Date.now();

				// nextRunAt should be approximately now + 1000ms
				expect(job.attrs.nextRunAt).toBeDefined();
				const nextRunAt = job.attrs.nextRunAt!.getTime();
				expect(nextRunAt).toBeGreaterThanOrEqual(beforeSave + 1000);
				expect(nextRunAt).toBeLessThanOrEqual(afterSave + 1000 + 100); // Allow 100ms tolerance
			});

			it('should reset the timer on subsequent saves', async () => {
				agenda.define('debounceTest', async () => {});

				// First save
				const job1 = await agenda
					.create('debounceTest', { key: 'test2' })
					.unique({ 'data.key': 'test2' })
					.debounce(1000)
					.save();

				const firstNextRunAt = job1.attrs.nextRunAt!.getTime();

				// Wait a bit
				await new Promise(resolve => setTimeout(resolve, 200));

				// Second save should push nextRunAt forward
				const job2 = await agenda
					.create('debounceTest', { key: 'test2', updated: true })
					.unique({ 'data.key': 'test2' })
					.debounce(1000)
					.save();

				const secondNextRunAt = job2.attrs.nextRunAt!.getTime();

				// Second nextRunAt should be later than first
				expect(secondNextRunAt).toBeGreaterThan(firstNextRunAt);
				// And should be approximately 1000ms from now (not from first save)
				expect(secondNextRunAt).toBeGreaterThanOrEqual(Date.now() + 900);
			});

			it('should update job data on subsequent saves', async () => {
				agenda.define('debounceTest', async () => {});

				// First save
				await agenda
					.create('debounceTest', { key: 'test3', value: 'first' })
					.unique({ 'data.key': 'test3' })
					.debounce(1000)
					.save();

				// Second save with updated data
				const job2 = await agenda
					.create('debounceTest', { key: 'test3', value: 'second' })
					.unique({ 'data.key': 'test3' })
					.debounce(1000)
					.save();

				// Data should be updated to the latest
				expect(job2.attrs.data).toEqual({ key: 'test3', value: 'second' });
			});

			it('should only create one job in the database', async () => {
				agenda.define('debounceTest', async () => {});

				// Multiple rapid saves
				for (let i = 0; i < 5; i++) {
					await agenda
						.create('debounceTest', { key: 'test4', iteration: i })
						.unique({ 'data.key': 'test4' })
						.debounce(500)
						.save();
				}

				// Query jobs
				const result = await agenda.queryJobs({ name: 'debounceTest' });
				expect(result.jobs.length).toBe(1);
				expect(result.jobs[0].data).toEqual({ key: 'test4', iteration: 4 });
			});
		});

		describe('leading debounce', () => {
			it('should execute immediately on first call', async () => {
				agenda.define('debounceLeading', async () => {});

				const beforeSave = Date.now();
				const job = await agenda
					.create('debounceLeading', { key: 'lead1' })
					.unique({ 'data.key': 'lead1' })
					.debounce(5000, { strategy: 'leading' })
					.save();

				const afterSave = Date.now();

				// nextRunAt should be approximately now (immediate execution)
				expect(job.attrs.nextRunAt).toBeDefined();
				const nextRunAt = job.attrs.nextRunAt!.getTime();
				expect(nextRunAt).toBeGreaterThanOrEqual(beforeSave - 100);
				expect(nextRunAt).toBeLessThanOrEqual(afterSave + 100);
			});

			it('should keep original nextRunAt on subsequent saves', async () => {
				agenda.define('debounceLeading', async () => {});

				// First save
				const job1 = await agenda
					.create('debounceLeading', { key: 'lead2' })
					.unique({ 'data.key': 'lead2' })
					.debounce(5000, { strategy: 'leading' })
					.save();

				const firstNextRunAt = job1.attrs.nextRunAt!.getTime();

				// Wait a bit
				await new Promise(resolve => setTimeout(resolve, 200));

				// Second save should NOT change nextRunAt
				const job2 = await agenda
					.create('debounceLeading', { key: 'lead2', updated: true })
					.unique({ 'data.key': 'lead2' })
					.debounce(5000, { strategy: 'leading' })
					.save();

				const secondNextRunAt = job2.attrs.nextRunAt!.getTime();

				// nextRunAt should remain the same
				expect(secondNextRunAt).toBe(firstNextRunAt);
			});

			it('should still update job data on subsequent saves', async () => {
				agenda.define('debounceLeading', async () => {});

				// First save
				await agenda
					.create('debounceLeading', { key: 'lead3', value: 'first' })
					.unique({ 'data.key': 'lead3' })
					.debounce(5000, { strategy: 'leading' })
					.save();

				// Second save with updated data
				const job2 = await agenda
					.create('debounceLeading', { key: 'lead3', value: 'second' })
					.unique({ 'data.key': 'lead3' })
					.debounce(5000, { strategy: 'leading' })
					.save();

				// Data should be updated even though nextRunAt isn't
				expect(job2.attrs.data).toEqual({ key: 'lead3', value: 'second' });
			});
		});

		describe('maxWait', () => {
			it('should force execution when maxWait is exceeded', async () => {
				agenda.define('debounceMaxWait', async () => {});

				// First save with short maxWait
				const job1 = await agenda
					.create('debounceMaxWait', { key: 'max1' })
					.unique({ 'data.key': 'max1' })
					.debounce(2000, { maxWait: 500 })
					.save();

				// debounceStartedAt should be set
				expect(job1.attrs.debounceStartedAt).toBeDefined();

				// Wait for maxWait to be exceeded
				await new Promise(resolve => setTimeout(resolve, 600));

				// Second save should trigger immediate execution
				const job2 = await agenda
					.create('debounceMaxWait', { key: 'max1', updated: true })
					.unique({ 'data.key': 'max1' })
					.debounce(2000, { maxWait: 500 })
					.save();

				// nextRunAt should be now (not delayed by 2000ms)
				const now = Date.now();
				expect(job2.attrs.nextRunAt!.getTime()).toBeLessThanOrEqual(now + 100);

				// debounceStartedAt should be cleared for next cycle
				// (may be undefined or null depending on backend)
				expect(job2.attrs.debounceStartedAt ?? undefined).toBeUndefined();
			});

			it('should keep debouncing while within maxWait', async () => {
				agenda.define('debounceMaxWait', async () => {});

				const beforeFirstSave = Date.now();

				// First save
				const job1 = await agenda
					.create('debounceMaxWait', { key: 'max2' })
					.unique({ 'data.key': 'max2' })
					.debounce(500, { maxWait: 5000 })
					.save();

				const firstNextRunAt = job1.attrs.nextRunAt!.getTime();

				// Wait less than maxWait
				await new Promise(resolve => setTimeout(resolve, 200));

				// Second save should still debounce normally
				const job2 = await agenda
					.create('debounceMaxWait', { key: 'max2', updated: true })
					.unique({ 'data.key': 'max2' })
					.debounce(500, { maxWait: 5000 })
					.save();

				const secondNextRunAt = job2.attrs.nextRunAt!.getTime();

				// Should be pushed forward (normal debounce behavior)
				expect(secondNextRunAt).toBeGreaterThan(firstNextRunAt);
				// Should still be delayed by ~500ms from now
				expect(secondNextRunAt).toBeGreaterThanOrEqual(Date.now() + 400);
			});
		});

		describe('debounce with different unique keys', () => {
			it('should debounce independently per unique key', async () => {
				agenda.define('debounceMulti', async () => {});

				// Save with key 1
				const job1 = await agenda
					.create('debounceMulti', { entityId: 1 })
					.unique({ 'data.entityId': 1 })
					.debounce(1000)
					.save();

				// Save with key 2
				const job2 = await agenda
					.create('debounceMulti', { entityId: 2 })
					.unique({ 'data.entityId': 2 })
					.debounce(1000)
					.save();

				// Query jobs
				const result = await agenda.queryJobs({ name: 'debounceMulti' });
				expect(result.jobs.length).toBe(2);

				// Each should have its own debounce timer
				expect(job1.attrs._id).not.toBe(job2.attrs._id);
			});
		});

		describe('debounce requires unique constraint', () => {
			it('should work only when unique constraint is set', async () => {
				agenda.define('debounceNoUnique', async () => {});

				// Without unique - creates new jobs each time
				const job1 = await agenda
					.create('debounceNoUnique', { value: 1 })
					.debounce(1000)
					.save();

				const job2 = await agenda
					.create('debounceNoUnique', { value: 2 })
					.debounce(1000)
					.save();

				// Should create separate jobs since no unique constraint
				expect(job1.attrs._id).not.toBe(job2.attrs._id);

				const result = await agenda.queryJobs({ name: 'debounceNoUnique' });
				expect(result.jobs.length).toBe(2);
			});
		});

		describe('job execution with debounce', () => {
			it('should execute job after debounce delay', async () => {
				let executed = false;
				let executedData: unknown;

				agenda.define('debounceExec', async (job) => {
					executed = true;
					executedData = job.attrs.data;
				});

				// Multiple saves within debounce window
				await agenda
					.create('debounceExec', { key: 'exec1', value: 1 })
					.unique({ 'data.key': 'exec1' })
					.debounce(200)
					.save();

				await new Promise(resolve => setTimeout(resolve, 50));

				await agenda
					.create('debounceExec', { key: 'exec1', value: 2 })
					.unique({ 'data.key': 'exec1' })
					.debounce(200)
					.save();

				await new Promise(resolve => setTimeout(resolve, 50));

				await agenda
					.create('debounceExec', { key: 'exec1', value: 3 })
					.unique({ 'data.key': 'exec1' })
					.debounce(200)
					.save();

				// Start processing
				await agenda.start();

				// Wait for debounce delay + processing time
				await new Promise(resolve => setTimeout(resolve, 400));

				// Job should have executed once with the latest data
				expect(executed).toBe(true);
				expect(executedData).toEqual({ key: 'exec1', value: 3 });

				// Only one job should exist
				const result = await agenda.queryJobs({ name: 'debounceExec' });
				expect(result.jobs.length).toBe(1);
			});
		});
	});
}
