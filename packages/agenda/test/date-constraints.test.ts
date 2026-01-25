import { expect, describe, it } from 'vitest';
import {
	applyAllDateConstraints,
	applyDateRangeConstraints,
	applySkipDays,
	shouldSkipDay,
	isWithinDateRange
} from '../src/utils/dateConstraints';

/**
 * Unit tests for Date Constraints Utilities
 * These tests don't require a database backend.
 *
 * Integration tests for date constraints with Job and Agenda are in the
 * @agendajs/mongo-backend package's test suite.
 */

describe('Date Constraints Utilities', () => {
	describe('shouldSkipDay', () => {
		it('returns false when skipDays is empty', () => {
			const date = new Date('2024-01-15T10:00:00Z'); // Monday
			expect(shouldSkipDay(date, [])).toBe(false);
		});

		it('returns false when skipDays is undefined', () => {
			const date = new Date('2024-01-15T10:00:00Z'); // Monday
			expect(shouldSkipDay(date, undefined)).toBe(false);
		});

		it('returns true when day is in skipDays (Monday=1)', () => {
			const monday = new Date('2024-01-15T10:00:00Z'); // Monday
			expect(shouldSkipDay(monday, [1])).toBe(true);
		});

		it('returns true when day is in skipDays (Sunday=0)', () => {
			const sunday = new Date('2024-01-14T10:00:00Z'); // Sunday
			expect(shouldSkipDay(sunday, [0])).toBe(true);
		});

		it('returns false when day is not in skipDays', () => {
			const monday = new Date('2024-01-15T10:00:00Z'); // Monday
			expect(shouldSkipDay(monday, [0, 6])).toBe(false); // Skip weekends
		});

		it('handles weekend skip (Saturday=6, Sunday=0)', () => {
			const saturday = new Date('2024-01-13T10:00:00Z'); // Saturday
			const sunday = new Date('2024-01-14T10:00:00Z'); // Sunday
			const monday = new Date('2024-01-15T10:00:00Z'); // Monday

			expect(shouldSkipDay(saturday, [0, 6])).toBe(true);
			expect(shouldSkipDay(sunday, [0, 6])).toBe(true);
			expect(shouldSkipDay(monday, [0, 6])).toBe(false);
		});

		it('respects timezone when checking day', () => {
			// This date is Sunday in UTC but Monday in UTC+12
			const date = new Date('2024-01-14T20:00:00Z');
			expect(shouldSkipDay(date, [0], 'UTC')).toBe(true); // Sunday in UTC
			expect(shouldSkipDay(date, [1], 'Pacific/Auckland')).toBe(true); // Monday in NZ
		});
	});

	describe('applySkipDays', () => {
		it('returns original date when skipDays is empty', () => {
			const date = new Date('2024-01-15T10:00:00Z'); // Monday
			const result = applySkipDays(date, []);
			expect(result?.getTime()).toBe(date.getTime());
		});

		it('returns original date when day is not skipped', () => {
			const monday = new Date('2024-01-15T10:00:00Z');
			const result = applySkipDays(monday, [0, 6]); // Skip weekends
			expect(result?.getTime()).toBe(monday.getTime());
		});

		it('moves to next valid day when day is skipped', () => {
			const saturday = new Date('2024-01-13T10:00:00Z'); // Saturday
			const result = applySkipDays(saturday, [0, 6]); // Skip weekends
			// Should move to Monday
			expect(result).not.toBeNull();
			expect(result!.getUTCDay()).toBe(1); // Monday
		});

		it('preserves time when moving to next day', () => {
			const saturday = new Date('2024-01-13T14:30:00Z'); // Saturday at 14:30
			const result = applySkipDays(saturday, [6]); // Skip Saturday only
			expect(result).not.toBeNull();
			expect(result!.getUTCHours()).toBe(14);
			expect(result!.getUTCMinutes()).toBe(30);
		});

		it('returns null when all days are skipped', () => {
			const date = new Date('2024-01-15T10:00:00Z');
			const result = applySkipDays(date, [0, 1, 2, 3, 4, 5, 6]);
			expect(result).toBeNull();
		});

		it('skips multiple consecutive days', () => {
			const friday = new Date('2024-01-12T10:00:00Z'); // Friday
			// Skip Friday (5), Saturday (6), Sunday (0)
			const result = applySkipDays(friday, [5, 6, 0]);
			expect(result).not.toBeNull();
			expect(result!.getUTCDay()).toBe(1); // Monday
		});
	});

	describe('applyDateRangeConstraints', () => {
		it('returns original date when no constraints', () => {
			const date = new Date('2024-01-15T10:00:00Z');
			const result = applyDateRangeConstraints(date);
			expect(result?.getTime()).toBe(date.getTime());
		});

		it('moves to startDate when date is before startDate', () => {
			const date = new Date('2024-01-10T10:00:00Z');
			const startDate = new Date('2024-01-15T10:00:00Z');
			const result = applyDateRangeConstraints(date, startDate);
			expect(result?.getTime()).toBe(startDate.getTime());
		});

		it('returns null when date is after endDate', () => {
			const date = new Date('2024-01-20T10:00:00Z');
			const endDate = new Date('2024-01-15T10:00:00Z');
			const result = applyDateRangeConstraints(date, undefined, endDate);
			expect(result).toBeNull();
		});

		it('returns original date when within range', () => {
			const date = new Date('2024-01-15T10:00:00Z');
			const startDate = new Date('2024-01-10T10:00:00Z');
			const endDate = new Date('2024-01-20T10:00:00Z');
			const result = applyDateRangeConstraints(date, startDate, endDate);
			expect(result?.getTime()).toBe(date.getTime());
		});
	});

	describe('applyAllDateConstraints', () => {
		it('applies both startDate and skipDays', () => {
			// Date before start, and start is on a Saturday
			const date = new Date('2024-01-10T10:00:00Z');
			const startDate = new Date('2024-01-13T10:00:00Z'); // Saturday
			const result = applyAllDateConstraints(date, {
				startDate,
				skipDays: [0, 6] // Skip weekends
			});
			expect(result).not.toBeNull();
			// Should be Monday after the startDate Saturday
			expect(result!.getUTCDay()).toBe(1); // Monday
		});

		it('returns null when skip days moves past endDate', () => {
			const date = new Date('2024-01-13T10:00:00Z'); // Saturday
			const endDate = new Date('2024-01-14T10:00:00Z'); // Sunday
			const result = applyAllDateConstraints(date, {
				skipDays: [0, 6], // Skip weekends - would move to Monday
				endDate
			});
			expect(result).toBeNull();
		});
	});

	describe('isWithinDateRange', () => {
		it('returns true when no constraints', () => {
			const date = new Date('2024-01-15T10:00:00Z');
			expect(isWithinDateRange(date)).toBe(true);
		});

		it('returns false when before startDate', () => {
			const date = new Date('2024-01-10T10:00:00Z');
			const startDate = new Date('2024-01-15T10:00:00Z');
			expect(isWithinDateRange(date, startDate)).toBe(false);
		});

		it('returns false when after endDate', () => {
			const date = new Date('2024-01-20T10:00:00Z');
			const endDate = new Date('2024-01-15T10:00:00Z');
			expect(isWithinDateRange(date, undefined, endDate)).toBe(false);
		});

		it('returns true when within range', () => {
			const date = new Date('2024-01-15T10:00:00Z');
			const startDate = new Date('2024-01-10T10:00:00Z');
			const endDate = new Date('2024-01-20T10:00:00Z');
			expect(isWithinDateRange(date, startDate, endDate)).toBe(true);
		});
	});
});
