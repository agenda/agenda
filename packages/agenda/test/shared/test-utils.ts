/**
 * Shared test utilities for Agenda test suites
 */

import type { Agenda } from '../../src';

/**
 * Promise-based delay utility
 */
export const delay = (ms: number): Promise<void> =>
	new Promise(resolve => setTimeout(resolve, ms));

/**
 * Wait for a single event with timeout
 */
export function waitForEvent(
	agenda: Agenda,
	eventName: string,
	timeoutMs: number = 5000
): Promise<unknown> {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			reject(new Error(`Timeout waiting for event: ${eventName}`));
		}, timeoutMs);

		agenda.once(eventName, (...args: unknown[]) => {
			clearTimeout(timeout);
			resolve(args[0]);
		});
	});
}

/**
 * Wait for multiple occurrences of an event with timeout
 */
export function waitForEvents(
	agenda: Agenda,
	eventName: string,
	count: number,
	timeoutMs: number = 10000
): Promise<unknown[]> {
	return new Promise((resolve, reject) => {
		const results: unknown[] = [];
		const timeout = setTimeout(() => {
			reject(new Error(`Timeout waiting for ${count} ${eventName} events, got ${results.length}`));
		}, timeoutMs);

		const handler = (...args: unknown[]) => {
			results.push(args[0]);
			if (results.length >= count) {
				clearTimeout(timeout);
				agenda.off(eventName, handler);
				resolve(results);
			}
		};

		agenda.on(eventName, handler);
	});
}