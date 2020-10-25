import { CronTime } from 'cron';
import * as moment from 'moment-timezone';
import * as humanInterval from 'human-interval';
import * as date from 'date.js';
import * as debug from 'debug';
import type { IJobParameters } from '../types/JobParameters';
import { isValidDate } from './isValidDate';

const log = debug('agenda:nextRunAt');

const dateForTimezone = (timezoneDate: Date, timezone?: string): moment.Moment => {
	const momentDate = moment(timezoneDate);
	if (timezone) {
		momentDate.tz(timezone);
	}

	return momentDate;
};

export function isValidHumanInterval(value: unknown): value is string {
	const transformedValue = humanInterval(value as string);
	return typeof transformedValue === 'number' && Number.isNaN(transformedValue) === false;
}

/**
 * Internal method that computes the interval
 * @returns {undefined}
 */
export const computeFromInterval = (attrs: IJobParameters): Date => {
	const previousNextRunAt = attrs.nextRunAt || new Date();
	log('[%s:%s] computing next run via interval [%s]', attrs.name, attrs._id, attrs.repeatInterval);
	const lastRun = dateForTimezone(attrs.lastRunAt || new Date(), attrs.repeatTimezone);
	let nextRunAt: Date | null = null;

	if (typeof attrs.repeatInterval === 'string') {
		try {
			const cronTime = new CronTime(attrs.repeatInterval);
			let nextDate: Date = cronTime._getNextDateFrom(lastRun);
			if (
				nextDate.valueOf() === lastRun.valueOf() ||
				nextDate.valueOf() <= previousNextRunAt.valueOf()
			) {
				// Handle cronTime giving back the same date for the next run time
				nextDate = cronTime._getNextDateFrom(
					dateForTimezone(new Date(lastRun.valueOf() + 1000), attrs.repeatTimezone)
				);
			}

			nextRunAt = nextDate;

			// eslint-disable-next-line no-empty
		} catch (error) {}
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
		throw new Error('failed to calculate nextRunAt due to invalid repeat interval');
	}

	return nextRunAt;
};

/**
 * Internal method to compute next run time from the repeat string
 * @returns {undefined}
 */
export function computeFromRepeatAt(attrs: IJobParameters): Date {
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
