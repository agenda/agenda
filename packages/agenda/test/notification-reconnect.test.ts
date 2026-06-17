/**
 * Tests for BaseNotificationChannel reconnect/backoff behavior.
 *
 * These verify that reconnection honors `maxAttempts`, uses exponential backoff,
 * gives up with an error, and restores the full retry budget after a successful
 * reconnect.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BaseNotificationChannel } from '../src/notifications/BaseNotificationChannel.js';
import type { JobNotification } from '../src/index.js';

/**
 * Test channel that fails to connect a configurable number of times, then succeeds.
 * Mirrors the real subclass wiring: clearReconnect() at the top of connect(),
 * scheduleReconnect() on failure.
 */
class FlakyChannel extends BaseNotificationChannel {
	public connectCalls = 0;

	/** Number of leading connect() calls that should fail. Infinity = always fail. */
	public failUntilCall = Infinity;

	async connect(): Promise<void> {
		this.connectCalls += 1;
		this.clearReconnect();
		try {
			if (this.connectCalls <= this.failUntilCall) {
				throw new Error('connect failed');
			}
			this.setState('connected');
		} catch (error) {
			this.scheduleReconnect();
			throw error;
		}
	}

	async disconnect(): Promise<void> {
		this.clearReconnect();
		this.setState('disconnected');
	}

	async publish(_notification: JobNotification): Promise<void> {}

	get reconnectAttemptsForTest(): number {
		return this.reconnectAttempts;
	}
}

describe('BaseNotificationChannel reconnect', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('stops after maxAttempts, reaches error state, emits give-up error, and backs off', async () => {
		const channel = new FlakyChannel({
			reconnect: { enabled: true, maxAttempts: 3, initialDelayMs: 100, maxDelayMs: 30000 }
		});

		const errors: Error[] = [];
		channel.on('error', err => errors.push(err));

		// Initial connect fails and schedules the first reconnect.
		await expect(channel.connect()).rejects.toThrow('connect failed');
		expect(channel.connectCalls).toBe(1);

		// Drain all scheduled reconnect timers.
		await vi.runAllTimersAsync();

		// connect() is called at most maxAttempts + 1 times (initial + maxAttempts retries).
		expect(channel.connectCalls).toBeLessThanOrEqual(4);
		// It should actually exhaust the budget (not give up early, not loop forever).
		expect(channel.connectCalls).toBe(4);

		// Final state is 'error' and the give-up error was emitted.
		expect(channel.state).toBe('error');
		expect(errors.some(e => /Max reconnection attempts reached/i.test(e.message))).toBe(true);
	});

	it('uses exponential backoff between attempts', async () => {
		const channel = new FlakyChannel({
			reconnect: { enabled: true, maxAttempts: 4, initialDelayMs: 100, maxDelayMs: 30000 }
		});
		channel.on('error', () => {});

		const delays: number[] = [];
		const realSetTimeout = globalThis.setTimeout;
		const spy = vi
			.spyOn(globalThis, 'setTimeout')
			.mockImplementation(((fn: (...args: unknown[]) => void, ms?: number, ...rest: unknown[]) => {
				if (typeof ms === 'number') {
					delays.push(ms);
				}
				return (realSetTimeout as typeof globalThis.setTimeout)(fn, ms, ...rest);
			}) as typeof globalThis.setTimeout);

		await expect(channel.connect()).rejects.toThrow();
		await vi.runAllTimersAsync();

		spy.mockRestore();

		// First few backoff delays should grow: 100, 200, 400, ...
		expect(delays.slice(0, 3)).toEqual([100, 200, 400]);
	});

	it('restores the full retry budget after a successful reconnect', async () => {
		const channel = new FlakyChannel({
			reconnect: { enabled: true, maxAttempts: 3, initialDelayMs: 100, maxDelayMs: 30000 }
		});
		channel.on('error', () => {});

		// Fail twice, then succeed on the 3rd connect() call.
		channel.failUntilCall = 2;

		await expect(channel.connect()).rejects.toThrow();
		await vi.runAllTimersAsync();

		expect(channel.state).toBe('connected');
		// Budget reset on success: a later failure run can again use the full budget.
		expect(channel.reconnectAttemptsForTest).toBe(0);

		// Now make it always fail again and confirm we get a fresh full budget.
		channel.failUntilCall = Infinity;
		channel.connectCalls = 0;
		await expect(channel.connect()).rejects.toThrow();
		await vi.runAllTimersAsync();

		expect(channel.connectCalls).toBe(4); // initial + 3 retries again
		expect(channel.state).toBe('error');
	});
});
