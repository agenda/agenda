import { DateTime } from 'luxon';
import debug from 'debug';

const log = debug('agenda:dateConstraints');

/**
 * Maximum number of days to skip ahead when looking for a valid day.
 * This prevents infinite loops if all days are marked as skip days.
 */
const MAX_SKIP_ITERATIONS = 8;

/**
 * Check if a given date should be skipped based on the skip days configuration.
 * @param date - The date to check
 * @param skipDays - Array of days to skip (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 * @param timezone - Optional timezone for the check
 * @returns true if the day should be skipped
 */
export function shouldSkipDay(
	date: Date,
	skipDays?: number[],
	timezone?: string
): boolean {
	if (!skipDays || skipDays.length === 0) {
		return false;
	}

	const dt = timezone
		? DateTime.fromJSDate(date, { zone: timezone })
		: DateTime.fromJSDate(date);

	// Luxon weekday: 1 = Monday, 7 = Sunday
	// Convert to JS weekday: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
	const jsWeekday = dt.weekday === 7 ? 0 : dt.weekday;

	return skipDays.includes(jsWeekday);
}

/**
 * Applies skip days constraint to a date, moving forward to the next valid day.
 * Preserves the time of day from the original date.
 * @param date - The original date
 * @param skipDays - Array of days to skip (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 * @param timezone - Optional timezone
 * @returns The adjusted date on a valid day, or null if no valid day found
 */
export function applySkipDays(
	date: Date,
	skipDays?: number[],
	timezone?: string
): Date | null {
	if (!skipDays || skipDays.length === 0) {
		return date;
	}

	// Validate skip days - if all days are skipped, return null
	if (skipDays.length >= 7) {
		log('all days are marked as skip days, returning null');
		return null;
	}

	let dt = timezone
		? DateTime.fromJSDate(date, { zone: timezone })
		: DateTime.fromJSDate(date);

	let iterations = 0;

	// Luxon weekday: 1 = Monday, 7 = Sunday
	// Convert to JS weekday: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
	const getJsWeekday = (luxonDt: DateTime) =>
		luxonDt.weekday === 7 ? 0 : luxonDt.weekday;

	while (skipDays.includes(getJsWeekday(dt)) && iterations < MAX_SKIP_ITERATIONS) {
		dt = dt.plus({ days: 1 });
		iterations++;
		log('skipping day, moved to %s', dt.toISO());
	}

	if (iterations >= MAX_SKIP_ITERATIONS) {
		log('exceeded max skip iterations, returning null');
		return null;
	}

	return dt.toJSDate();
}

/**
 * Applies date range constraints to a nextRunAt date.
 * - If nextRunAt is before startDate, returns startDate
 * - If nextRunAt is after endDate, returns null (job should not run)
 * @param nextRunAt - The computed next run time
 * @param startDate - Optional start date constraint
 * @param endDate - Optional end date constraint
 * @returns The adjusted date, or null if outside valid range
 */
export function applyDateRangeConstraints(
	nextRunAt: Date,
	startDate?: Date,
	endDate?: Date
): Date | null {
	let result = nextRunAt;

	// If before start date, move to start date
	if (startDate && result < startDate) {
		log('nextRunAt %s is before startDate %s, adjusting', result.toISOString(), startDate.toISOString());
		result = new Date(startDate);
	}

	// If after end date, return null (job should stop)
	if (endDate && result > endDate) {
		log('nextRunAt %s is after endDate %s, returning null', result.toISOString(), endDate.toISOString());
		return null;
	}

	return result;
}

/**
 * Apply all date constraints (date range and skip days) to a computed nextRunAt.
 * This is the main function to use when computing nextRunAt.
 * @param nextRunAt - The base computed next run time
 * @param options - Constraint options
 * @returns The adjusted date respecting all constraints, or null if invalid
 */
export function applyAllDateConstraints(
	nextRunAt: Date,
	options: {
		startDate?: Date;
		endDate?: Date;
		skipDays?: number[];
		timezone?: string;
	}
): Date | null {
	const { startDate, endDate, skipDays, timezone } = options;

	// Step 1: Apply date range constraints (start date)
	let result = applyDateRangeConstraints(nextRunAt, startDate, undefined);
	if (!result) {
		return null;
	}

	// Step 2: Apply skip days
	result = applySkipDays(result, skipDays, timezone);
	if (!result) {
		return null;
	}

	// Step 3: Check end date constraint again (skip days may have moved the date)
	if (endDate && result > endDate) {
		log('after skip days adjustment, date %s is after endDate %s', result.toISOString(), endDate.toISOString());
		return null;
	}

	return result;
}

/**
 * Check if a date is within the valid date range.
 * @param date - The date to check
 * @param startDate - Optional start date constraint
 * @param endDate - Optional end date constraint
 * @returns true if the date is within the valid range
 */
export function isWithinDateRange(
	date: Date,
	startDate?: Date,
	endDate?: Date
): boolean {
	if (startDate && date < startDate) {
		return false;
	}
	if (endDate && date > endDate) {
		return false;
	}
	return true;
}
