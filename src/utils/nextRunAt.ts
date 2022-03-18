/* eslint-disable import/first */
import { DateTime } from 'luxon';
import * as date from 'date.js';
import * as debug from 'debug';
import { parseExpression } from 'cron-parser';
import humanInterval = require('human-interval');
import { isValidDate } from './isValidDate';
import type { IJobParameters } from '../types/JobParameters';

const log = debug('agenda:nextRunAt');

const dateForTimezone = (timezoneDate: Date, timezone?: string): DateTime =>
	DateTime.fromJSDate(timezoneDate, { zone: timezone });

export function isValidHumanInterval(value: unknown): value is string {
	const transformedValue = humanInterval(value as string);
	return typeof transformedValue === 'number' && Number.isNaN(transformedValue) === false;
}

/**
 * Internal method that computes the interval
 */
export const computeFromInterval = (attrs: IJobParameters<any>): Date => {
	const previousNextRunAt = attrs.nextRunAt || new Date();
	log('[%s:%s] computing next run via interval [%s]', attrs.name, attrs._id, attrs.repeatInterval);

	const lastRun = dateForTimezone(attrs.lastRunAt || new Date(), attrs.repeatTimezone);

	const cronOptions = {
		currentDate: lastRun.toJSDate(),
		tz: attrs.repeatTimezone
	};

	let nextRunAt: Date | null = null;

	let error;
	if (typeof attrs.repeatInterval === 'string') {
		try {
			let cronTime = parseExpression(attrs.repeatInterval, cronOptions);
			let nextDate = cronTime.next().toDate();
			if (
				nextDate.valueOf() === lastRun.valueOf() ||
				nextDate.valueOf() <= previousNextRunAt.valueOf()
			) {
				// Handle cronTime giving back the same date for the next run time
				cronOptions.currentDate = new Date(lastRun.valueOf() + 1000);
				cronTime = parseExpression(attrs.repeatInterval, cronOptions);
				nextDate = cronTime.next().toDate();
			}

			nextRunAt = nextDate;

			// eslint-disable-next-line no-empty
		} catch (err) {
			error = err;
		}
	}

	if (isValidHumanInterval(attrs.repeatInterval)) {
		if (!attrs.lastRunAt) {
			nextRunAt = new Date(lastRun.valueOf());
		} else {
			const intervalValue = humanInterval(attrs.repeatInterval) as number;
			nextRunAt = new Date(lastRun.valueOf() + intervalValue);
		}
	}

	if (!isValidDate(nextRunAt)) {
		log(
			'[%s:%s] failed to calculate nextRunAt due to invalid repeat interval',
			attrs.name,
			attrs._id
		);
		throw new Error(
			`failed to calculate nextRunAt due to invalid repeat interval (${attrs.repeatInterval}): ${
				error || 'no readable human interval'
			}`
		);
	}

	return nextRunAt;
};

/**
 * Internal method to compute next run time from the repeat string
 * @returns {undefined}
 */
export function computeFromRepeatAt(attrs: IJobParameters<any>): Date {
	const lastRun = attrs.lastRunAt || new Date();
	const nextDate = date(attrs.repeatAt).valueOf();

	// If you do not specify offset date for below test it will fail for ms
	const offset = Date.now();

	if (offset === date(attrs.repeatAt, offset).valueOf()) {
		log('[%s:%s] failed to calculate repeatAt due to invalid format', attrs.name, attrs._id);
		// this.attrs.nextRunAt = undefined;
		// this.fail('failed to calculate repeatAt time due to invalid format');
		throw new Error('failed to calculate repeatAt time due to invalid format');
	}

	if (nextDate.valueOf() === lastRun.valueOf()) {
		return date('tomorrow at ', attrs.repeatAt);
	}

	return date(attrs.repeatAt);
}
