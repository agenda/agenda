/**
 * Shared test utilities for Agenda test suites
 */

import type { Agenda, AgendaEventName } from '../../src/index.js';

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
	eventName: AgendaEventName,
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
 * Schedule a job with agenda.now() and wait for an event (race-condition safe).
 * Sets up the event listener BEFORE scheduling the job to avoid missing fast events.
 */
export async function runJobAndWait(
	agenda: Agenda,
	jobName: string,
	eventName: AgendaEventName,
	data?: Record<string, unknown>,
	timeoutMs: number = 5000
): Promise<unknown> {
	const eventPromise = waitForEvent(agenda, eventName, timeoutMs);
	await agenda.now(jobName, data);
	return eventPromise;
}

/**
 * Wait for multiple occurrences of an event with timeout
 */
export function waitForEvents(
	agenda: Agenda,
	eventName: AgendaEventName,
	count: number,
	timeoutMs: number = 10000
): Promise<unknown[]> {
	return new Promise((resolve, reject) => {
		const results: unknown[] = [];
		const timeout = setTimeout(() => {
			reject(new Error(`Timeout waiting for ${count} ${eventName} events, got ${results.length}`));
		}, timeoutMs);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const handler = (...args: any[]) => {
			results.push(args[0]);
			if (results.length >= count) {
				clearTimeout(timeout);
				agenda.off(eventName, handler);
				resolve(results);
			}
		};

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		agenda.on(eventName as any, handler);
	});
}
