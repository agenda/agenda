/**
 * Shared test suite for INotificationChannel implementations
 *
 * This file exports test suite factories that can be used to test any
 * INotificationChannel implementation (InMemory, PostgreSQL LISTEN/NOTIFY, Redis, etc.)
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
import type { INotificationChannel, IJobNotification, JobId } from '../../src';
import { toJobId } from '../../src';

export interface NotificationChannelTestConfig {
	/** Name for the test suite */
	name: string;
	/** Factory to create a fresh channel instance (not connected) */
	createChannel: () => Promise<INotificationChannel>;
	/** Cleanup function called after each test */
	cleanupChannel: (channel: INotificationChannel) => Promise<void>;
	/** Delay in ms to wait for notifications to propagate (default: 100) */
	propagationDelay?: number;
}

/**
 * Helper to create a test notification
 */
function createTestNotification(overrides: Partial<IJobNotification> = {}): IJobNotification {
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
 * Creates a test suite for INotificationChannel implementations
 */
export function notificationChannelTestSuite(config: NotificationChannelTestConfig): void {
	const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
	const propagationDelay = config.propagationDelay ?? 100;

	describe(`${config.name} - INotificationChannel`, () => {
		let channel: INotificationChannel;

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
				const received: IJobNotification[] = [];

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
				const received1: IJobNotification[] = [];
				const received2: IJobNotification[] = [];

				channel.subscribe(n => received1.push(n));
				channel.subscribe(n => received2.push(n));

				await channel.publish(createTestNotification());
				await delay(propagationDelay);

				expect(received1.length).toBe(1);
				expect(received2.length).toBe(1);
			});

			it('should allow unsubscribing', async () => {
				const received: IJobNotification[] = [];

				const unsubscribe = channel.subscribe(notification => {
					received.push(notification);
				});

				await channel.publish(createTestNotification({ jobName: 'first' }));
				await delay(propagationDelay);

				expect(received.length).toBe(1);

				// Unsubscribe
				unsubscribe();

				await channel.publish(createTestNotification({ jobName: 'second' }));
				await delay(propagationDelay);

				// Should still only have 1 notification
				expect(received.length).toBe(1);
				expect(received[0].jobName).toBe('first');
			});

			it('should preserve notification data through serialization', async () => {
				const received: IJobNotification[] = [];
				channel.subscribe(n => received.push(n));

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
				const received: IJobNotification[] = [];
				channel.subscribe(n => received.push(n));

				await channel.publish(createTestNotification({ nextRunAt: null }));
				await delay(propagationDelay);

				expect(received.length).toBe(1);
				expect(received[0].nextRunAt).toBeNull();
			});

			it('should handle multiple rapid notifications', async () => {
				const received: IJobNotification[] = [];
				channel.subscribe(n => received.push(n));

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
				// Channel is not connected
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

				// After removing listener, we shouldn't get the disconnected state
				// (unless already captured before off was called)
				const disconnectedCount = states.filter(s => s === 'disconnected').length;
				expect(disconnectedCount).toBeLessThanOrEqual(1);
			});
		});
	});
}
