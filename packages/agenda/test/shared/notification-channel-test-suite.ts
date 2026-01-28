/**
 * Shared test suite for NotificationChannel implementations
 *
 * This file exports test suite factories that can be used to test any
 * NotificationChannel implementation (InMemory, PostgreSQL LISTEN/NOTIFY, Redis, etc.)
 *
 * Usage:
 * ```typescript
 * import { notificationChannelTestSuite } from 'agenda/test/shared';
 *
 * notificationChannelTestSuite({
 *   name: 'PostgresNotificationChannel',
 *   createChannel: async () => {
 *     const channel = new PostgresNotificationChannel(config);
 *     return channel;
 *   },
 *   cleanupChannel: async (channel) => {
 *     await channel.disconnect();
 *   }
 * });
 * ```
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { NotificationChannel, JobNotification, JobId, JobStateNotification, JobStateType } from '../../src/index.js';
import { toJobId } from '../../src/index.js';
import { delay } from './test-utils.js';

export interface NotificationChannelTestConfig {
	/** Name for the test suite */
	name: string;
	/** Factory to create a fresh channel instance (not connected) */
	createChannel: () => Promise<NotificationChannel>;
	/** Cleanup function called after each test */
	cleanupChannel: (channel: NotificationChannel) => Promise<void>;
	/** Delay in ms to wait for notifications to propagate (default: 100) */
	propagationDelay?: number;
}

/**
 * Helper to create a test notification
 */
function createTestNotification(overrides: Partial<JobNotification> = {}): JobNotification {
	return {
		jobId: toJobId('test-job-id') as JobId,
		jobName: 'test-job',
		nextRunAt: new Date(),
		priority: 0,
		timestamp: new Date(),
		...overrides
	};
}

/**
 * Helper to create a test state notification
 */
function createTestStateNotification(
	type: JobStateType,
	overrides: Partial<Omit<JobStateNotification, 'type'>> = {}
): JobStateNotification {
	return {
		type,
		jobId: toJobId('test-job-id') as JobId,
		jobName: 'test-job',
		timestamp: new Date(),
		...overrides
	};
}

/**
 * Creates a test suite for NotificationChannel implementations
 */
export function notificationChannelTestSuite(config: NotificationChannelTestConfig): void {
	const propagationDelay = config.propagationDelay ?? 100;

	describe(`${config.name} - NotificationChannel`, () => {
		let channel: NotificationChannel;

		beforeEach(async () => {
			channel = await config.createChannel();
		});

		afterEach(async () => {
			await config.cleanupChannel(channel);
		});

		describe('connection lifecycle', () => {
			it('should start in disconnected state', () => {
				expect(channel.state).toBe('disconnected');
			});

			it('should transition to connected state after connect', async () => {
				await channel.connect();
				expect(channel.state).toBe('connected');
			});

			it('should transition to disconnected state after disconnect', async () => {
				await channel.connect();
				expect(channel.state).toBe('connected');

				await channel.disconnect();
				expect(channel.state).toBe('disconnected');
			});

			it('should emit stateChange events', async () => {
				const states: string[] = [];

				channel.on('stateChange', state => {
					states.push(state);
				});

				await channel.connect();
				await channel.disconnect();

				expect(states).toContain('connected');
				expect(states).toContain('disconnected');
			});
		});

		describe('publish/subscribe', () => {
			beforeEach(async () => {
				await channel.connect();
			});

			it('should publish and receive notifications', async () => {
				const received: JobNotification[] = [];

				channel.subscribe(notification => {
					received.push(notification);
				});

				const notification = createTestNotification({
					jobName: 'publish-test',
					priority: 10
				});

				await channel.publish(notification);
				await delay(propagationDelay);

				expect(received.length).toBe(1);
				expect(received[0].jobName).toBe('publish-test');
				expect(received[0].priority).toBe(10);
			});

			it('should support multiple subscribers', async () => {
				const received1: JobNotification[] = [];
				const received2: JobNotification[] = [];

				channel.subscribe(n => { received1.push(n); });
				channel.subscribe(n => { received2.push(n); });

				await channel.publish(createTestNotification());
				await delay(propagationDelay);

				expect(received1.length).toBe(1);
				expect(received2.length).toBe(1);
			});

			it('should allow unsubscribing', async () => {
				const received: JobNotification[] = [];

				const unsubscribe = channel.subscribe(notification => {
					received.push(notification);
				});

				await channel.publish(createTestNotification({ jobName: 'first' }));
				await delay(propagationDelay);

				expect(received.length).toBe(1);

				unsubscribe();

				await channel.publish(createTestNotification({ jobName: 'second' }));
				await delay(propagationDelay);

				expect(received.length).toBe(1);
				expect(received[0].jobName).toBe('first');
			});

			it('should preserve notification data through serialization', async () => {
				const received: JobNotification[] = [];
				channel.subscribe(n => { received.push(n); });

				const originalDate = new Date('2024-01-15T10:30:00.000Z');
				const notification = createTestNotification({
					jobId: toJobId('specific-id') as JobId,
					jobName: 'data-test',
					nextRunAt: originalDate,
					priority: 42,
					source: 'test-source'
				});

				await channel.publish(notification);
				await delay(propagationDelay);

				expect(received.length).toBe(1);
				expect(received[0].jobId.toString()).toBe('specific-id');
				expect(received[0].jobName).toBe('data-test');
				expect(received[0].nextRunAt?.toISOString()).toBe(originalDate.toISOString());
				expect(received[0].priority).toBe(42);
				expect(received[0].source).toBe('test-source');
			});

			it('should handle null nextRunAt', async () => {
				const received: JobNotification[] = [];
				channel.subscribe(n => { received.push(n); });

				await channel.publish(createTestNotification({ nextRunAt: null }));
				await delay(propagationDelay);

				expect(received.length).toBe(1);
				expect(received[0].nextRunAt).toBeNull();
			});

			it('should handle multiple rapid notifications', async () => {
				const received: JobNotification[] = [];
				channel.subscribe(n => { received.push(n); });

				const count = 5;
				for (let i = 0; i < count; i++) {
					await channel.publish(createTestNotification({ jobName: `job-${i}` }));
				}

				await delay(propagationDelay * 2);

				expect(received.length).toBe(count);
			});
		});

		describe('error handling', () => {
			it('should throw when publishing on disconnected channel', async () => {
				await expect(channel.publish(createTestNotification())).rejects.toThrow(
					/not connected/i
				);
			});

			it('should throw when publishing after disconnect', async () => {
				await channel.connect();
				await channel.disconnect();

				await expect(channel.publish(createTestNotification())).rejects.toThrow(
					/not connected/i
				);
			});
		});

		describe('event emitter', () => {
			it('should support on/off for stateChange events', async () => {
				const states: string[] = [];
				const handler = (state: string) => states.push(state);

				channel.on('stateChange', handler);
				await channel.connect();

				expect(states).toContain('connected');

				channel.off('stateChange', handler);
				await channel.disconnect();

				const disconnectedCount = states.filter(s => s === 'disconnected').length;
				expect(disconnectedCount).toBeLessThanOrEqual(1);
			});
		});

		describe('state notifications (bi-directional)', () => {
			beforeEach(async () => {
				await channel.connect();
			});

			it('should have subscribeState method', () => {
				expect(typeof channel.subscribeState).toBe('function');
			});

			it('should have publishState method', () => {
				expect(typeof channel.publishState).toBe('function');
			});

			it('should publish and receive state notifications', async () => {
				if (!channel.publishState || !channel.subscribeState) {
					// Skip if not supported
					return;
				}

				const received: JobStateNotification[] = [];

				channel.subscribeState(notification => {
					received.push(notification);
				});

				const notification = createTestStateNotification('start', {
					jobName: 'state-test',
					lastRunAt: new Date()
				});

				await channel.publishState(notification);
				await delay(propagationDelay);

				expect(received.length).toBe(1);
				expect(received[0].type).toBe('start');
				expect(received[0].jobName).toBe('state-test');
			});

			it('should support multiple state subscribers', async () => {
				if (!channel.publishState || !channel.subscribeState) {
					return;
				}

				const received1: JobStateNotification[] = [];
				const received2: JobStateNotification[] = [];

				channel.subscribeState(n => { received1.push(n); });
				channel.subscribeState(n => { received2.push(n); });

				await channel.publishState(createTestStateNotification('success'));
				await delay(propagationDelay);

				expect(received1.length).toBe(1);
				expect(received2.length).toBe(1);
			});

			it('should allow unsubscribing from state notifications', async () => {
				if (!channel.publishState || !channel.subscribeState) {
					return;
				}

				const received: JobStateNotification[] = [];

				const unsubscribe = channel.subscribeState(notification => {
					received.push(notification);
				});

				await channel.publishState(createTestStateNotification('start', { jobName: 'first' }));
				await delay(propagationDelay);

				expect(received.length).toBe(1);

				unsubscribe();

				await channel.publishState(createTestStateNotification('complete', { jobName: 'second' }));
				await delay(propagationDelay);

				expect(received.length).toBe(1);
				expect(received[0].jobName).toBe('first');
			});

			it('should preserve state notification data through serialization', async () => {
				if (!channel.publishState || !channel.subscribeState) {
					return;
				}

				const received: JobStateNotification[] = [];
				channel.subscribeState(n => { received.push(n); });

				const lastRunAt = new Date('2024-01-15T10:30:00.000Z');
				const lastFinishedAt = new Date('2024-01-15T10:31:00.000Z');
				const notification = createTestStateNotification('complete', {
					jobId: toJobId('specific-id') as JobId,
					jobName: 'data-test',
					source: 'test-source',
					lastRunAt,
					lastFinishedAt,
					duration: 60000
				});

				await channel.publishState(notification);
				await delay(propagationDelay);

				expect(received.length).toBe(1);
				expect(received[0].type).toBe('complete');
				expect(received[0].jobId.toString()).toBe('specific-id');
				expect(received[0].jobName).toBe('data-test');
				expect(received[0].source).toBe('test-source');
				expect(received[0].lastRunAt?.toISOString()).toBe(lastRunAt.toISOString());
				expect(received[0].lastFinishedAt?.toISOString()).toBe(lastFinishedAt.toISOString());
				expect(received[0].duration).toBe(60000);
			});

			it('should handle fail notifications with error info', async () => {
				if (!channel.publishState || !channel.subscribeState) {
					return;
				}

				const received: JobStateNotification[] = [];
				channel.subscribeState(n => { received.push(n); });

				await channel.publishState(createTestStateNotification('fail', {
					error: 'Something went wrong',
					failCount: 3
				}));
				await delay(propagationDelay);

				expect(received.length).toBe(1);
				expect(received[0].type).toBe('fail');
				expect(received[0].error).toBe('Something went wrong');
				expect(received[0].failCount).toBe(3);
			});

			it('should handle retry notifications', async () => {
				if (!channel.publishState || !channel.subscribeState) {
					return;
				}

				const received: JobStateNotification[] = [];
				channel.subscribeState(n => { received.push(n); });

				const retryAt = new Date('2024-01-15T11:00:00.000Z');
				await channel.publishState(createTestStateNotification('retry', {
					retryAt,
					retryAttempt: 2,
					error: 'Temporary failure'
				}));
				await delay(propagationDelay);

				expect(received.length).toBe(1);
				expect(received[0].type).toBe('retry');
				expect(received[0].retryAt?.toISOString()).toBe(retryAt.toISOString());
				expect(received[0].retryAttempt).toBe(2);
				expect(received[0].error).toBe('Temporary failure');
			});

			it('should handle progress notifications', async () => {
				if (!channel.publishState || !channel.subscribeState) {
					return;
				}

				const received: JobStateNotification[] = [];
				channel.subscribeState(n => { received.push(n); });

				await channel.publishState(createTestStateNotification('progress', {
					progress: 75
				}));
				await delay(propagationDelay);

				expect(received.length).toBe(1);
				expect(received[0].type).toBe('progress');
				expect(received[0].progress).toBe(75);
			});

			it('should handle multiple rapid state notifications', async () => {
				if (!channel.publishState || !channel.subscribeState) {
					return;
				}

				const received: JobStateNotification[] = [];
				channel.subscribeState(n => { received.push(n); });

				const types: JobStateType[] = ['start', 'progress', 'success', 'complete'];
				for (const type of types) {
					await channel.publishState(createTestStateNotification(type));
				}

				await delay(propagationDelay * 2);

				expect(received.length).toBe(types.length);
				expect(received.map(n => n.type)).toEqual(types);
			});

			it('should throw when publishing state on disconnected channel', async () => {
				if (!channel.publishState) {
					return;
				}

				await channel.disconnect();

				await expect(channel.publishState(createTestStateNotification('start'))).rejects.toThrow(
					/not connected/i
				);
			});
		});
	});
}
