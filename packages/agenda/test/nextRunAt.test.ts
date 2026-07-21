/**
 * Unit tests for computeFromInterval (pure logic, no backend).
 */

import { describe, it, expect } from 'vitest';
import { computeFromInterval } from '../src/utils/nextRunAt.js';
import type { JobParameters } from '../src/index.js';

function baseAttrs(overrides: Partial<JobParameters<unknown>>): JobParameters<unknown> {
	return {
		name: 'test',
		priority: 0,
		type: 'normal',
		nextRunAt: null,
		data: {},
		...overrides
	} as JobParameters<unknown>;
}

describe('computeFromInterval - numeric millisecond repeatInterval', () => {
	it('treats a numeric repeatInterval as milliseconds', () => {
		const lastRunAt = new Date('2026-01-01T00:00:00.000Z');
		const result = computeFromInterval(
			baseAttrs({ repeatInterval: 5000, lastRunAt, nextRunAt: lastRunAt })
		);
		expect(result?.getTime()).toBe(lastRunAt.getTime() + 5000);
	});

	it('treats a purely-numeric string repeatInterval as milliseconds', () => {
		const lastRunAt = new Date('2026-01-01T00:00:00.000Z');
		const result = computeFromInterval(
			baseAttrs({ repeatInterval: '5000', lastRunAt, nextRunAt: lastRunAt })
		);
		expect(result?.getTime()).toBe(lastRunAt.getTime() + 5000);
	});

	it('uses lastRunAt as-is for the first numeric run when lastRunAt is absent', () => {
		const result = computeFromInterval(baseAttrs({ repeatInterval: 5000 }));
		expect(result).toBeInstanceOf(Date);
	});

	it('still parses cron expressions', () => {
		const lastRunAt = new Date('2026-01-01T00:00:00.000Z');
		const result = computeFromInterval(
			baseAttrs({ repeatInterval: '0 * * * *', lastRunAt, nextRunAt: lastRunAt })
		);
		expect(result).toBeInstanceOf(Date);
		expect(result!.getTime()).toBeGreaterThan(lastRunAt.getTime());
	});

	it('still parses human intervals', () => {
		const lastRunAt = new Date('2026-01-01T00:00:00.000Z');
		const result = computeFromInterval(
			baseAttrs({ repeatInterval: '5 minutes', lastRunAt, nextRunAt: lastRunAt })
		);
		expect(result?.getTime()).toBe(lastRunAt.getTime() + 5 * 60 * 1000);
	});
});
