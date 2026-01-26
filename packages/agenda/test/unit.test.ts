/**
 * Unit tests for Agenda that don't require a real backend.
 * These tests verify pure logic without database interaction.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Agenda, Job } from '../src';
import type { IAgendaBackend } from '../src/types/AgendaBackend';
import type { IJobRepository } from '../src/types/JobRepository';
import type { IJobParameters } from '../src/types/JobParameters';

/**
 * Minimal mock repository that satisfies the interface without real storage.
 * Used for unit tests that don't need actual database operations.
 */
class MockJobRepository implements IJobRepository {
	async connect(): Promise<void> {}
	async queryJobs() {
		return { jobs: [], total: 0 };
	}
	async getJobsOverview() {
		return [];
	}
	async getDistinctJobNames() {
		return [];
	}
	async getJobById() {
		return null;
	}
	async getQueueSize() {
		return 0;
	}
	async removeJobs() {
		return 0;
	}
	async saveJob<DATA = unknown>(job: IJobParameters<DATA>): Promise<IJobParameters<DATA>> {
		return { ...job, _id: job._id || 'mock-id' };
	}
	async saveJobState() {}
	async lockJob() {
		return undefined;
	}
	async unlockJob() {}
	async unlockJobs() {}
	async getNextJobToRun() {
		return undefined;
	}
}

/**
 * Minimal mock backend for unit tests
 */
class MockBackend implements IAgendaBackend {
	readonly repository = new MockJobRepository();
	async connect(): Promise<void> {}
	async disconnect(): Promise<void> {}
}

describe('Agenda Unit Tests', () => {
	let agenda: Agenda;
	let backend: MockBackend;

	beforeEach(async () => {
		backend = new MockBackend();
		agenda = new Agenda({ backend });
		await agenda.ready;
	});

	describe('configuration', () => {
		it('sets a default processEvery', () => {
			const newAgenda = new Agenda({ backend });
			expect(newAgenda.attrs.processEvery).toBe(5000);
		});

		it('should set processEvery from string', () => {
			const newAgenda = new Agenda({ backend });
			newAgenda.processEvery('3 minutes');
			expect(newAgenda.attrs.processEvery).toBe(180000);
		});

		it('should set processEvery from number', () => {
			const newAgenda = new Agenda({ backend, processEvery: 1000 });
			expect(newAgenda.attrs.processEvery).toBe(1000);
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

	describe('configuration method chaining', () => {
		it('name returns itself', () => {
			expect(agenda.name('test queue')).toBe(agenda);
		});

		it('processEvery returns itself', () => {
			expect(agenda.processEvery('3 minutes')).toBe(agenda);
		});

		it('maxConcurrency returns itself', () => {
			expect(agenda.maxConcurrency(10)).toBe(agenda);
		});

		it('defaultConcurrency returns itself', () => {
			expect(agenda.defaultConcurrency(5)).toBe(agenda);
		});

		it('lockLimit returns itself', () => {
			expect(agenda.lockLimit(10)).toBe(agenda);
		});

		it('defaultLockLimit returns itself', () => {
			expect(agenda.defaultLockLimit(5)).toBe(agenda);
		});

		it('defaultLockLifetime returns itself', () => {
			expect(agenda.defaultLockLifetime(1000)).toBe(agenda);
		});

		it('sort returns itself', () => {
			expect(agenda.sort({ nextRunAt: 1, priority: -1 })).toBe(agenda);
		});
	});

	describe('define', () => {
		it('stores the definition', () => {
			agenda.define('customJob', () => {}, { priority: 5 });
			expect(agenda.definitions.customJob).toBeDefined();
			expect(agenda.definitions.customJob.priority).toBe(5);
		});

		it('sets default concurrency', () => {
			agenda.define('concurrencyJob', () => {});
			expect(agenda.definitions.concurrencyJob.concurrency).toBe(agenda.attrs.defaultConcurrency);
		});

		it('sets default lockLimit', () => {
			agenda.define('lockLimitJob', () => {});
			expect(agenda.definitions.lockLimitJob.lockLimit).toBe(agenda.attrs.defaultLockLimit);
		});

		it('inherits defaultLockLifetime', () => {
			agenda.defaultLockLifetime(7777);
			agenda.define('testDefaultLockLifetime', () => {});
			expect(agenda.definitions.testDefaultLockLifetime.lockLifetime).toBe(7777);
		});
	});

	describe('job creation with create()', () => {
		it('creates a job instance', () => {
			agenda.define('test job', () => {});
			const job = agenda.create('test job', { data: 1 });
			expect(job).toBeInstanceOf(Job);
		});

		it('creates a job with data', () => {
			agenda.define('test job', () => {});
			const job = agenda.create('test job', { key: 'value' });
			expect(job.attrs.data).toEqual({ key: 'value' });
		});

		it('sets the type to normal', () => {
			agenda.define('sendEmail', () => {});
			const job = agenda.create('sendEmail', { to: 'some guy' });
			expect(job.attrs.type).toBe('normal');
		});

		it('sets the agenda reference', () => {
			agenda.define('sendEmail', () => {});
			const job = agenda.create('sendEmail', { to: 'some guy' });
			expect(job.agenda).toBe(agenda);
		});
	});
});

describe('Job Unit Tests', () => {
	let agenda: Agenda;
	let backend: MockBackend;

	beforeEach(async () => {
		backend = new MockBackend();
		agenda = new Agenda({ backend });
		await agenda.ready;
	});

	describe('repeatAt', () => {
		it('sets the repeat time', () => {
			const job = new Job(agenda, { name: 'demo', type: 'normal' });
			job.repeatAt('3:30pm');
			expect(job.attrs.repeatAt).toBe('3:30pm');
		});

		it('returns the job', () => {
			const job = new Job(agenda, { name: 'demo', type: 'normal' });
			expect(job.repeatAt('3:30pm')).toBe(job);
		});
	});

	describe('toJson', () => {
		it('handles null failedAt', () => {
			const job = new Job(agenda, {
				name: 'demo',
				type: 'normal',
				nextRunAt: null,
				failedAt: null as unknown as Date
			});
			expect(job.toJson().failedAt).not.toBeInstanceOf(Date);
		});

		it('preserves Date failedAt', () => {
			const job = new Job(agenda, {
				name: 'demo',
				type: 'normal',
				nextRunAt: null,
				failedAt: new Date()
			});
			expect(job.toJson().failedAt).toBeInstanceOf(Date);
		});
	});

	describe('unique', () => {
		it('sets unique constraint', () => {
			const job = new Job(agenda, { name: 'demo', type: 'normal' });
			job.unique({ 'data.type': 'active', 'data.userId': '123' });
			expect(job.attrs.unique).toEqual({ 'data.type': 'active', 'data.userId': '123' });
		});

		it('returns the job', () => {
			const job = new Job(agenda, { name: 'demo', type: 'normal' });
			expect(job.unique({})).toBe(job);
		});
	});

	describe('repeatEvery', () => {
		it('sets the repeat interval', () => {
			const job = new Job(agenda, { name: 'demo', type: 'normal' });
			job.repeatEvery('5 seconds');
			expect(job.attrs.repeatInterval).toBe('5 seconds');
		});

		it('returns the job', () => {
			const job = new Job(agenda, { name: 'demo', type: 'normal' });
			expect(job.repeatEvery('5 seconds')).toBe(job);
		});

		it('accepts timezone option', () => {
			const job = new Job(agenda, { name: 'demo', type: 'normal' });
			job.repeatEvery('0 6 * * *', { timezone: 'America/New_York' });
			expect(job.attrs.repeatInterval).toBe('0 6 * * *');
			expect(job.attrs.repeatTimezone).toBe('America/New_York');
		});

		it('handles skipImmediate option', () => {
			// Without skipImmediate, nextRunAt should be approximately now
			const jobImmediate = new Job(agenda, { name: 'demo', type: 'normal' });
			jobImmediate.repeatEvery('5 minutes');
			const immediateDiff = Math.abs(
				(jobImmediate.attrs.nextRunAt?.getTime() || 0) - Date.now()
			);

			// With skipImmediate, nextRunAt should be ~5 minutes from now
			const jobSkipped = new Job(agenda, { name: 'demo2', type: 'normal' });
			jobSkipped.repeatEvery('5 minutes', { skipImmediate: true });
			const skippedDiff = (jobSkipped.attrs.nextRunAt?.getTime() || 0) - Date.now();

			// Without skip, should be very close to now (within 1 second)
			expect(immediateDiff).toBeLessThan(1000);
			// With skip, should be ~5 minutes in future (at least 4 minutes)
			expect(skippedDiff).toBeGreaterThan(4 * 60 * 1000);
		});
	});

	describe('schedule', () => {
		it('sets nextRunAt from Date', () => {
			const job = new Job(agenda, { name: 'demo', type: 'normal' });
			const when = new Date(Date.now() + 60000);
			job.schedule(when);
			expect(job.attrs.nextRunAt?.getTime()).toBe(when.getTime());
		});

		it('returns the job', () => {
			const job = new Job(agenda, { name: 'demo', type: 'normal' });
			expect(job.schedule('in 5 minutes')).toBe(job);
		});

		it('accepts string time', () => {
			const job = new Job(agenda, { name: 'demo', type: 'normal' });
			job.schedule('in 5 minutes');
			expect(job.attrs.nextRunAt).toBeDefined();
			expect(job.attrs.nextRunAt!.getTime()).toBeGreaterThan(Date.now());
		});
	});

	describe('priority', () => {
		it('sets the priority number', () => {
			const job = new Job(agenda, { name: 'demo', type: 'normal' });
			job.priority(10);
			expect(job.attrs.priority).toBe(10);
		});

		it('returns the job', () => {
			const job = new Job(agenda, { name: 'demo', type: 'normal' });
			expect(job.priority(10)).toBe(job);
		});

		it('parses lowest priority string', () => {
			const job = new Job(agenda, { name: 'demo', type: 'normal' });
			job.priority('lowest');
			expect(job.attrs.priority).toBe(-20);
		});

		it('parses low priority string', () => {
			const job = new Job(agenda, { name: 'demo', type: 'normal' });
			job.priority('low');
			expect(job.attrs.priority).toBe(-10);
		});

		it('parses normal priority string', () => {
			const job = new Job(agenda, { name: 'demo', type: 'normal' });
			job.priority('normal');
			expect(job.attrs.priority).toBe(0);
		});

		it('parses high priority string', () => {
			const job = new Job(agenda, { name: 'demo', type: 'normal' });
			job.priority('high');
			expect(job.attrs.priority).toBe(10);
		});

		it('parses highest priority string', () => {
			const job = new Job(agenda, { name: 'demo', type: 'normal' });
			job.priority('highest');
			expect(job.attrs.priority).toBe(20);
		});
	});

	describe('computeNextRunAt', () => {
		it('computes next run for interval jobs', () => {
			const job = new Job(agenda, {
				name: 'demo',
				type: 'normal',
				repeatInterval: '5 minutes'
			});
			job.computeNextRunAt();
			expect(job.attrs.nextRunAt).toBeDefined();
			// nextRunAt should be approximately now (within 1 second)
			// since this is a new job without skipImmediate
			expect(Math.abs(job.attrs.nextRunAt!.getTime() - Date.now())).toBeLessThan(1000);
		});

		it('returns the job', () => {
			const job = new Job(agenda, {
				name: 'demo',
				type: 'normal',
				repeatInterval: '5 minutes'
			});
			expect(job.computeNextRunAt()).toBe(job);
		});

		it('handles cron expressions', () => {
			const job = new Job(agenda, {
				name: 'demo',
				type: 'normal',
				repeatInterval: '0 6 * * *' // 6am daily
			});
			job.computeNextRunAt();
			expect(job.attrs.nextRunAt).toBeDefined();
		});

		it('respects timezone for cron', () => {
			const job = new Job(agenda, {
				name: 'demo',
				type: 'normal',
				repeatInterval: '0 6 * * *',
				repeatTimezone: 'America/New_York'
			});
			job.computeNextRunAt();
			expect(job.attrs.nextRunAt).toBeDefined();
		});

		it('handles repeatAt times', () => {
			const job = new Job(agenda, {
				name: 'demo',
				type: 'normal',
				repeatAt: '3:30pm'
			});
			job.computeNextRunAt();
			expect(job.attrs.nextRunAt).toBeDefined();
		});

		// Note: skipImmediate is tested in the repeatEvery describe block
	});

	describe('fail', () => {
		it('sets failReason from Error', () => {
			const job = new Job(agenda, { name: 'demo', type: 'normal' });
			job.fail(new Error('Test error'));
			expect(job.attrs.failReason).toBe('Test error');
		});

		it('sets failReason from string', () => {
			const job = new Job(agenda, { name: 'demo', type: 'normal' });
			job.fail('String error');
			expect(job.attrs.failReason).toBe('String error');
		});

		it('sets failedAt', () => {
			const job = new Job(agenda, { name: 'demo', type: 'normal' });
			job.fail(new Error('Test error'));
			expect(job.attrs.failedAt).toBeDefined();
			expect(job.attrs.failedAt).toBeInstanceOf(Date);
		});

		it('increments failCount', () => {
			const job = new Job(agenda, { name: 'demo', type: 'normal', failCount: 2 });
			job.fail(new Error('Test error'));
			expect(job.attrs.failCount).toBe(3);
		});

		it('returns the job', () => {
			const job = new Job(agenda, { name: 'demo', type: 'normal' });
			expect(job.fail(new Error('Test error'))).toBe(job);
		});
	});

	describe('enable', () => {
		it('sets disabled to false', () => {
			const job = new Job(agenda, { name: 'demo', type: 'normal', disabled: true });
			job.enable();
			expect(job.attrs.disabled).toBe(false);
		});

		it('returns the job', () => {
			const job = new Job(agenda, { name: 'demo', type: 'normal', disabled: true });
			expect(job.enable()).toBe(job);
		});
	});

	describe('disable', () => {
		it('sets disabled to true', () => {
			const job = new Job(agenda, { name: 'demo', type: 'normal' });
			job.disable();
			expect(job.attrs.disabled).toBe(true);
		});

		it('returns the job', () => {
			const job = new Job(agenda, { name: 'demo', type: 'normal' });
			expect(job.disable()).toBe(job);
		});
	});
});