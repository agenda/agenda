/**
 * Shared test suite for JobLogger implementations.
 *
 * Tests the JobLogger interface contract: log(), getLogs(), clearLogs()
 * with filtering, pagination, and sorting. Each backend package runs this
 * suite with its own logger implementation (MongoJobLogger, PostgresJobLogger,
 * RedisJobLogger).
 *
 * Usage:
 * ```typescript
 * import { jobLoggerTestSuite } from 'agenda/testing';
 *
 * jobLoggerTestSuite({
 *   name: 'MongoJobLogger',
 *   createLogger: async () => new MongoJobLogger({ db }),
 *   cleanupLogger: async () => { await db.collection('agenda_logs').drop(); }
 * });
 * ```
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { JobLogger, JobLogEntry } from '../../src/index.js';

export interface JobLoggerTestConfig {
	/** Name for the test suite (e.g., 'MongoJobLogger') */
	name: string;
	/** Factory to create a fresh logger instance (already connected/initialized) */
	createLogger: () => Promise<JobLogger>;
	/** Cleanup between tests — clear all logs */
	cleanupLogger: (logger: JobLogger) => Promise<void>;
}

function makeEntry(overrides: Partial<Omit<JobLogEntry, '_id'>> = {}): Omit<JobLogEntry, '_id'> {
	return {
		timestamp: new Date(),
		level: 'info',
		event: 'start',
		jobName: 'test-job',
		message: 'Job started',
		...overrides
	};
}

export function jobLoggerTestSuite(config: JobLoggerTestConfig): void {
	describe(`JobLogger: ${config.name}`, () => {
		let logger: JobLogger;

		beforeEach(async () => {
			logger = await config.createLogger();
			await config.cleanupLogger(logger);
		});

		describe('log()', () => {
			it('should store a log entry', async () => {
				await logger.log(makeEntry());

				const result = await logger.getLogs();
				expect(result.total).toBe(1);
				expect(result.entries).toHaveLength(1);
				expect(result.entries[0].level).toBe('info');
				expect(result.entries[0].event).toBe('start');
				expect(result.entries[0].jobName).toBe('test-job');
				expect(result.entries[0].message).toBe('Job started');
			});

			it('should store all optional fields', async () => {
				await logger.log(makeEntry({
					jobId: 'job-123',
					duration: 1500,
					error: 'Something went wrong',
					failCount: 3,
					retryDelay: 5000,
					retryAttempt: 2,
					agendaName: 'worker-1',
					meta: { customKey: 'customValue' }
				}));

				const result = await logger.getLogs();
				expect(result.total).toBe(1);
				const entry = result.entries[0];
				expect(entry.jobId).toBe('job-123');
				expect(entry.duration).toBe(1500);
				expect(entry.error).toBe('Something went wrong');
				expect(entry.failCount).toBe(3);
				expect(entry.retryDelay).toBe(5000);
				expect(entry.retryAttempt).toBe(2);
				expect(entry.agendaName).toBe('worker-1');
				expect(entry.meta).toEqual({ customKey: 'customValue' });
			});

			it('should store multiple entries', async () => {
				await logger.log(makeEntry({ event: 'start', message: 'Started' }));
				await logger.log(makeEntry({ event: 'success', message: 'Succeeded' }));
				await logger.log(makeEntry({ event: 'complete', message: 'Completed' }));

				const result = await logger.getLogs();
				expect(result.total).toBe(3);
				expect(result.entries).toHaveLength(3);
			});
		});

		describe('getLogs()', () => {
			beforeEach(async () => {
				// Seed with a variety of entries
				const baseTime = new Date('2025-06-01T12:00:00Z');
				await logger.log(makeEntry({
					timestamp: new Date(baseTime.getTime()),
					event: 'start',
					level: 'info',
					jobName: 'job-a',
					jobId: 'id-1',
					message: 'Job A started'
				}));
				await logger.log(makeEntry({
					timestamp: new Date(baseTime.getTime() + 1000),
					event: 'success',
					level: 'info',
					jobName: 'job-a',
					jobId: 'id-1',
					message: 'Job A succeeded',
					duration: 1000
				}));
				await logger.log(makeEntry({
					timestamp: new Date(baseTime.getTime() + 2000),
					event: 'start',
					level: 'info',
					jobName: 'job-b',
					jobId: 'id-2',
					message: 'Job B started'
				}));
				await logger.log(makeEntry({
					timestamp: new Date(baseTime.getTime() + 3000),
					event: 'fail',
					level: 'error',
					jobName: 'job-b',
					jobId: 'id-2',
					message: 'Job B failed',
					error: 'timeout'
				}));
				await logger.log(makeEntry({
					timestamp: new Date(baseTime.getTime() + 4000),
					event: 'retry',
					level: 'warn',
					jobName: 'job-b',
					jobId: 'id-2',
					message: 'Job B retrying',
					retryAttempt: 1,
					retryDelay: 5000
				}));
			});

			it('should return all entries when no filter is provided', async () => {
				const result = await logger.getLogs();
				expect(result.total).toBe(5);
				expect(result.entries).toHaveLength(5);
			});

			it('should filter by jobName', async () => {
				const result = await logger.getLogs({ jobName: 'job-a' });
				expect(result.total).toBe(2);
				for (const entry of result.entries) {
					expect(entry.jobName).toBe('job-a');
				}
			});

			it('should filter by jobId', async () => {
				const result = await logger.getLogs({ jobId: 'id-2' });
				expect(result.total).toBe(3);
				for (const entry of result.entries) {
					expect(entry.jobId).toBe('id-2');
				}
			});

			it('should filter by single level', async () => {
				const result = await logger.getLogs({ level: 'error' });
				expect(result.total).toBe(1);
				expect(result.entries[0].event).toBe('fail');
			});

			it('should filter by level array', async () => {
				const result = await logger.getLogs({ level: ['error', 'warn'] });
				expect(result.total).toBe(2);
				for (const entry of result.entries) {
					expect(['error', 'warn']).toContain(entry.level);
				}
			});

			it('should filter by single event', async () => {
				const result = await logger.getLogs({ event: 'start' });
				expect(result.total).toBe(2);
				for (const entry of result.entries) {
					expect(entry.event).toBe('start');
				}
			});

			it('should filter by event array', async () => {
				const result = await logger.getLogs({ event: ['fail', 'retry'] });
				expect(result.total).toBe(2);
				for (const entry of result.entries) {
					expect(['fail', 'retry']).toContain(entry.event);
				}
			});

			it('should filter by date range (from)', async () => {
				const from = new Date('2025-06-01T12:00:03Z');
				const result = await logger.getLogs({ from });
				expect(result.total).toBe(2); // fail + retry
				for (const entry of result.entries) {
					expect(entry.timestamp.getTime()).toBeGreaterThanOrEqual(from.getTime());
				}
			});

			it('should filter by date range (to)', async () => {
				const to = new Date('2025-06-01T12:00:01Z');
				const result = await logger.getLogs({ to });
				expect(result.total).toBe(2); // start + success
				for (const entry of result.entries) {
					expect(entry.timestamp.getTime()).toBeLessThanOrEqual(to.getTime());
				}
			});

			it('should filter by date range (from + to)', async () => {
				const from = new Date('2025-06-01T12:00:01Z');
				const to = new Date('2025-06-01T12:00:03Z');
				const result = await logger.getLogs({ from, to });
				expect(result.total).toBe(3); // success, start, fail
				for (const entry of result.entries) {
					expect(entry.timestamp.getTime()).toBeGreaterThanOrEqual(from.getTime());
					expect(entry.timestamp.getTime()).toBeLessThanOrEqual(to.getTime());
				}
			});

			it('should support limit', async () => {
				const result = await logger.getLogs({ limit: 2 });
				expect(result.entries).toHaveLength(2);
				expect(result.total).toBe(5); // total should reflect all matching, not limited
			});

			it('should support offset for pagination', async () => {
				const page1 = await logger.getLogs({ limit: 2, offset: 0, sort: 'asc' });
				const page2 = await logger.getLogs({ limit: 2, offset: 2, sort: 'asc' });

				expect(page1.entries).toHaveLength(2);
				expect(page2.entries).toHaveLength(2);
				// Different entries
				expect(page1.entries[0].message).not.toBe(page2.entries[0].message);
			});

			it('should sort descending by default', async () => {
				const result = await logger.getLogs();
				for (let i = 1; i < result.entries.length; i++) {
					expect(result.entries[i - 1].timestamp.getTime())
						.toBeGreaterThanOrEqual(result.entries[i].timestamp.getTime());
				}
			});

			it('should sort ascending when requested', async () => {
				const result = await logger.getLogs({ sort: 'asc' });
				for (let i = 1; i < result.entries.length; i++) {
					expect(result.entries[i - 1].timestamp.getTime())
						.toBeLessThanOrEqual(result.entries[i].timestamp.getTime());
				}
			});

			it('should return empty result when no entries match', async () => {
				const result = await logger.getLogs({ jobName: 'nonexistent' });
				expect(result.total).toBe(0);
				expect(result.entries).toHaveLength(0);
			});
		});

		describe('clearLogs()', () => {
			beforeEach(async () => {
				await logger.log(makeEntry({ jobName: 'job-a', event: 'start', level: 'info' }));
				await logger.log(makeEntry({ jobName: 'job-a', event: 'success', level: 'info' }));
				await logger.log(makeEntry({ jobName: 'job-b', event: 'fail', level: 'error' }));
			});

			it('should clear all logs when no filter is provided', async () => {
				const deleted = await logger.clearLogs();
				expect(deleted).toBe(3);

				const result = await logger.getLogs();
				expect(result.total).toBe(0);
			});

			it('should clear logs filtered by jobName', async () => {
				const deleted = await logger.clearLogs({ jobName: 'job-a' });
				expect(deleted).toBe(2);

				const result = await logger.getLogs();
				expect(result.total).toBe(1);
				expect(result.entries[0].jobName).toBe('job-b');
			});

			it('should return 0 when no logs match the filter', async () => {
				const deleted = await logger.clearLogs({ jobName: 'nonexistent' });
				expect(deleted).toBe(0);

				const result = await logger.getLogs();
				expect(result.total).toBe(3);
			});
		});
	});
}
