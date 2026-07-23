import { describe, expect, it } from 'vitest';
import { isValidDate } from '../src/utils/isValidDate.js';

describe('isValidDate', () => {
	it('returns true for a valid Date object', () => {
		expect(isValidDate(new Date('2026-07-25T10:00:00Z'))).toBe(true);
	});

	it('returns false for an invalid Date object', () => {
		expect(isValidDate(new Date('invalid'))).toBe(false);
	});

	it('returns false for a date string', () => {
		// The type predicate narrows to Date, but a string is not a Date instance.
		expect(isValidDate('2026-07-25T10:00:00Z')).toBe(false);
	});

	it('returns false for non-Date types', () => {
		expect(isValidDate(null)).toBe(false);
		expect(isValidDate(undefined)).toBe(false);
		expect(isValidDate(1234567890)).toBe(false);
		expect(isValidDate({})).toBe(false);
	});
});
