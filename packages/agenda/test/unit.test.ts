/**
 * Unit tests for Agenda that don't require a real backend.
 * These tests verify pure logic without database interaction.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Agenda, Job, toJobId } from '../src/index.js';
import type { AgendaBackend, JobRepository, JobParameters, JobLogger, JobLogEntry, JobLogQuery, JobLogQueryResult } from '../src/index.js';
import { computeJobState } from '../src/types/JobQuery.js';

/**
 * Minimal mock repository that satisfies the interface without real storage.
 * Used for unit tests that don't need actual database operations.
 */
class MockJobRepository implements JobRepository {
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
	async disableJobs() {
		return 0;
	}
	async enableJobs() {
		return 0;
	}
	async saveJob<DATA = unknown>(job: JobParameters<DATA>): Promise<JobParameters<DATA>> {
		return { ...job, _id: job._id || toJobId('mock-id') };
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
class MockBackend implements AgendaBackend {
	readonly name = 'MockBackend';
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
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(job as any).computeNextRunAt();
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
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			expect((job as any).computeNextRunAt()).toBe(job);
		});

		it('handles cron expressions', () => {
			const job = new Job(agenda, {
				name: 'demo',
				type: 'normal',
				repeatInterval: '0 6 * * *' // 6am daily
			});
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(job as any).computeNextRunAt();
			expect(job.attrs.nextRunAt).toBeDefined();
		});

		it('respects timezone for cron', () => {
			const job = new Job(agenda, {
				name: 'demo',
				type: 'normal',
				repeatInterval: '0 6 * * *',
				repeatTimezone: 'America/New_York'
			});
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(job as any).computeNextRunAt();
			expect(job.attrs.nextRunAt).toBeDefined();
		});

		it('handles repeatAt times', () => {
			const job = new Job(agenda, {
				name: 'demo',
				type: 'normal',
				repeatAt: '3:30pm'
			});
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(job as any).computeNextRunAt();
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

/**
 * Mock JobLogger for testing logging configuration and logJobEvent behavior.
 */
class MockJobLogger implements JobLogger {
	entries: Omit<JobLogEntry, '_id'>[] = [];
	logSpy = vi.fn(async (entry: Omit<JobLogEntry, '_id'>) => {
		this.entries.push(entry);
	});
	getLogsSpy = vi.fn(async (query?: JobLogQuery): Promise<JobLogQueryResult> => {
		let filtered = [...this.entries];
		if (query?.jobName) {
			filtered = filtered.filter(e => e.jobName === query.jobName);
		}
		return { entries: filtered as JobLogEntry[], total: filtered.length };
	});
	clearLogsSpy = vi.fn(async (query?: JobLogQuery): Promise<number> => {
		if (!query) {
			const count = this.entries.length;
			this.entries = [];
			return count;
		}
		const before = this.entries.length;
		if (query.jobName) {
			this.entries = this.entries.filter(e => e.jobName !== query.jobName);
		}
		return before - this.entries.length;
	});

	async log(entry: Omit<JobLogEntry, '_id'>): Promise<void> {
		return this.logSpy(entry);
	}
	async getLogs(query?: JobLogQuery): Promise<JobLogQueryResult> {
		return this.getLogsSpy(query);
	}
	async clearLogs(query?: JobLogQuery): Promise<number> {
		return this.clearLogsSpy(query);
	}
}

/**
 * Mock backend that provides a JobLogger
 */
class MockBackendWithLogger implements AgendaBackend {
	readonly name = 'MockBackendWithLogger';
	readonly repository = new MockJobRepository();
	readonly logger: JobLogger;

	constructor(logger: JobLogger) {
		this.logger = logger;
	}

	async connect(): Promise<void> {}
	async disconnect(): Promise<void> {}
}

describe('Logging Configuration', () => {
	it('should not have a jobLogger when logging is omitted', async () => {
		const backend = new MockBackend();
		const agenda = new Agenda({ backend });
		await agenda.ready;
		expect(agenda.jobLogger).toBeUndefined();
		expect(agenda.hasJobLogger()).toBe(false);
	});

	it('should not have a jobLogger when logging is false', async () => {
		const backend = new MockBackend();
		const agenda = new Agenda({ backend, logging: false });
		await agenda.ready;
		expect(agenda.jobLogger).toBeUndefined();
		expect(agenda.hasJobLogger()).toBe(false);
	});

	it('should use backend logger when logging is true', async () => {
		const mockLogger = new MockJobLogger();
		const backend = new MockBackendWithLogger(mockLogger);
		const agenda = new Agenda({ backend, logging: true });
		await agenda.ready;
		expect(agenda.jobLogger).toBe(mockLogger);
		expect(agenda.hasJobLogger()).toBe(true);
		expect(agenda.loggingDefault).toBe(true);
	});

	it('should use custom JobLogger instance when passed directly', async () => {
		const mockLogger = new MockJobLogger();
		const backend = new MockBackend();
		const agenda = new Agenda({ backend, logging: mockLogger });
		await agenda.ready;
		expect(agenda.jobLogger).toBe(mockLogger);
		expect(agenda.hasJobLogger()).toBe(true);
		expect(agenda.loggingDefault).toBe(true);
	});

	it('should use backend logger with { default: false }', async () => {
		const mockLogger = new MockJobLogger();
		const backend = new MockBackendWithLogger(mockLogger);
		const agenda = new Agenda({ backend, logging: { default: false } });
		await agenda.ready;
		expect(agenda.jobLogger).toBe(mockLogger);
		expect(agenda.loggingDefault).toBe(false);
	});

	it('should use custom logger from { logger: JobLogger }', async () => {
		const mockLogger = new MockJobLogger();
		const backend = new MockBackend();
		const agenda = new Agenda({ backend, logging: { logger: mockLogger } });
		await agenda.ready;
		expect(agenda.jobLogger).toBe(mockLogger);
		expect(agenda.loggingDefault).toBe(true);
	});

	it('should use custom logger with { logger, default: false }', async () => {
		const mockLogger = new MockJobLogger();
		const backend = new MockBackend();
		const agenda = new Agenda({ backend, logging: { logger: mockLogger, default: false } });
		await agenda.ready;
		expect(agenda.jobLogger).toBe(mockLogger);
		expect(agenda.loggingDefault).toBe(false);
	});
});

describe('logJobEvent', () => {
	let mockLogger: MockJobLogger;
	let agenda: Agenda;

	beforeEach(async () => {
		mockLogger = new MockJobLogger();
		const backend = new MockBackendWithLogger(mockLogger);
		agenda = new Agenda({ backend, logging: true });
		await agenda.ready;
	});

	it('should log an event when logging is enabled', async () => {
		agenda.define('my-job', async () => {});
		agenda.logJobEvent({
			level: 'info',
			event: 'start',
			jobName: 'my-job',
			jobId: 'abc',
			message: 'Job started'
		});

		// logJobEvent is fire-and-forget, wait for promise
		await vi.waitFor(() => expect(mockLogger.logSpy).toHaveBeenCalled());

		const call = mockLogger.logSpy.mock.calls[0][0];
		expect(call.level).toBe('info');
		expect(call.event).toBe('start');
		expect(call.jobName).toBe('my-job');
		expect(call.jobId).toBe('abc');
		expect(call.message).toBe('Job started');
		expect(call.timestamp).toBeInstanceOf(Date);
	});

	it('should not log when no jobLogger is configured', () => {
		const backendNoLogger = new MockBackend();
		const agendaNoLogger = new Agenda({ backend: backendNoLogger });

		// Should not throw
		agendaNoLogger.logJobEvent({
			level: 'info',
			event: 'start',
			jobName: 'test',
			message: 'test'
		});
	});

	it('should respect per-definition logging: true override with loggingDefault: false', async () => {
		const backend = new MockBackendWithLogger(mockLogger);
		agenda = new Agenda({ backend, logging: { default: false } });
		await agenda.ready;

		agenda.define('logged-job', async () => {}, { logging: true });
		agenda.define('unlogged-job', async () => {});

		agenda.logJobEvent({
			level: 'info', event: 'start', jobName: 'logged-job', message: 'started'
		});
		agenda.logJobEvent({
			level: 'info', event: 'start', jobName: 'unlogged-job', message: 'started'
		});

		await vi.waitFor(() => expect(mockLogger.logSpy).toHaveBeenCalled());
		// Small delay to ensure any async calls settle
		await new Promise(r => setTimeout(r, 50));

		expect(mockLogger.logSpy).toHaveBeenCalledTimes(1);
		expect(mockLogger.logSpy.mock.calls[0][0].jobName).toBe('logged-job');
	});

	it('should respect per-definition logging: false override with loggingDefault: true', async () => {
		agenda.define('logged-job', async () => {});
		agenda.define('silenced-job', async () => {}, { logging: false });

		agenda.logJobEvent({
			level: 'info', event: 'start', jobName: 'logged-job', message: 'started'
		});
		agenda.logJobEvent({
			level: 'info', event: 'start', jobName: 'silenced-job', message: 'started'
		});

		await vi.waitFor(() => expect(mockLogger.logSpy).toHaveBeenCalled());
		await new Promise(r => setTimeout(r, 50));

		expect(mockLogger.logSpy).toHaveBeenCalledTimes(1);
		expect(mockLogger.logSpy.mock.calls[0][0].jobName).toBe('logged-job');
	});

	it('should include agendaName in log entries', async () => {
		const backend = new MockBackendWithLogger(mockLogger);
		agenda = new Agenda({ backend, logging: true });
		await agenda.ready;
		agenda.name('my-worker');
		agenda.define('my-job', async () => {});

		agenda.logJobEvent({
			level: 'info', event: 'start', jobName: 'my-job', message: 'started'
		});

		await vi.waitFor(() => expect(mockLogger.logSpy).toHaveBeenCalled());
		expect(mockLogger.logSpy.mock.calls[0][0].agendaName).toBe('my-worker');
	});
});

describe('getLogs and clearLogs', () => {
	let mockLogger: MockJobLogger;
	let agenda: Agenda;

	beforeEach(async () => {
		mockLogger = new MockJobLogger();
		const backend = new MockBackendWithLogger(mockLogger);
		agenda = new Agenda({ backend, logging: true });
		await agenda.ready;
	});

	it('getLogs delegates to the jobLogger', async () => {
		const query = { jobName: 'test' };
		await agenda.getLogs(query);
		expect(mockLogger.getLogsSpy).toHaveBeenCalledWith(query);
	});

	it('getLogs returns empty when no logger is configured', async () => {
		const agendaNoLogger = new Agenda({ backend: new MockBackend() });
		await agendaNoLogger.ready;

		const result = await agendaNoLogger.getLogs({ jobName: 'test' });
		expect(result).toEqual({ entries: [], total: 0 });
	});

	it('clearLogs delegates to the jobLogger', async () => {
		const query = { jobName: 'test' };
		await agenda.clearLogs(query);
		expect(mockLogger.clearLogsSpy).toHaveBeenCalledWith(query);
	});

	it('clearLogs returns 0 when no logger is configured', async () => {
		const agendaNoLogger = new Agenda({ backend: new MockBackend() });
		await agendaNoLogger.ready;

		const result = await agendaNoLogger.clearLogs();
		expect(result).toBe(0);
	});
});

describe('computeJobState', () => {
	const now = new Date('2026-02-08T12:00:00Z');

	function makeJob(overrides: Partial<JobParameters> = {}): JobParameters {
		return {
			name: 'test-job',
			priority: 0,
			nextRunAt: null,
			type: 'normal',
			data: {},
			...overrides
		};
	}

	it('should return "running" when lockedAt is set', () => {
		const job = makeJob({ lockedAt: new Date('2026-02-08T11:59:00Z') });
		expect(computeJobState(job, now)).toBe('running');
	});

	it('should return "running" even if also failed', () => {
		const job = makeJob({
			lockedAt: new Date('2026-02-08T11:59:00Z'),
			failedAt: new Date('2026-02-08T11:50:00Z')
		});
		expect(computeJobState(job, now)).toBe('running');
	});

	it('should return "failed" when failedAt is set and no lastFinishedAt', () => {
		const job = makeJob({ failedAt: new Date('2026-02-08T11:00:00Z') });
		expect(computeJobState(job, now)).toBe('failed');
	});

	it('should return "failed" when failedAt is after lastFinishedAt', () => {
		const job = makeJob({
			failedAt: new Date('2026-02-08T11:30:00Z'),
			lastFinishedAt: new Date('2026-02-08T11:00:00Z')
		});
		expect(computeJobState(job, now)).toBe('failed');
	});

	it('should return "failed" when failedAt equals lastFinishedAt (retry exhaustion)', () => {
		const sameTime = new Date('2026-02-08T11:00:00Z');
		const job = makeJob({
			failedAt: sameTime,
			lastFinishedAt: sameTime,
			failCount: 4
		});
		expect(computeJobState(job, now)).toBe('failed');
	});

	it('should return "completed" when lastFinishedAt is after failedAt', () => {
		const job = makeJob({
			lastFinishedAt: new Date('2026-02-08T11:30:00Z'),
			failedAt: new Date('2026-02-08T11:00:00Z')
		});
		expect(computeJobState(job, now)).toBe('completed');
	});

	it('should return "completed" when lastFinishedAt is set and no failedAt', () => {
		const job = makeJob({
			lastFinishedAt: new Date('2026-02-08T11:00:00Z')
		});
		expect(computeJobState(job, now)).toBe('completed');
	});

	it('should return "repeating" when repeatInterval is set and not failed', () => {
		const job = makeJob({
			repeatInterval: '5 minutes',
			nextRunAt: new Date('2026-02-08T12:05:00Z')
		});
		expect(computeJobState(job, now)).toBe('repeating');
	});

	it('should return "failed" over "repeating" when job has failed', () => {
		const job = makeJob({
			repeatInterval: '5 minutes',
			failedAt: new Date('2026-02-08T11:00:00Z')
		});
		expect(computeJobState(job, now)).toBe('failed');
	});

	it('should return "scheduled" when nextRunAt is in the future', () => {
		const job = makeJob({
			nextRunAt: new Date('2026-02-08T13:00:00Z')
		});
		expect(computeJobState(job, now)).toBe('scheduled');
	});

	it('should return "queued" when nextRunAt is now', () => {
		const job = makeJob({
			nextRunAt: new Date('2026-02-08T12:00:00Z')
		});
		expect(computeJobState(job, now)).toBe('queued');
	});

	it('should return "queued" when nextRunAt is in the past', () => {
		const job = makeJob({
			nextRunAt: new Date('2026-02-08T11:00:00Z')
		});
		expect(computeJobState(job, now)).toBe('queued');
	});

	it('should return "completed" for a job with no dates set', () => {
		const job = makeJob();
		expect(computeJobState(job, now)).toBe('completed');
	});
});
