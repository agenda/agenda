import { CronTime } from 'cron';
import * as moment from 'moment-timezone';
// what's the difference to regular moment package?
import * as humanInterval from 'human-interval';
import * as date from 'date.js';
import * as debug from 'debug';
import { IJobParameters } from '../types/JobParameters';
import { isValidDate } from './date';

const log = debug('agenda:nextRunAt');

const dateForTimezone = (timezoneDate: Date, timezone?: string): moment.Moment => {
	const momentDate = moment(timezoneDate);
	if (timezone) {
		momentDate.tz(timezone);
	}

	return momentDate; // .utc(false).toDate();
};

/**
 * Internal method that computes the interval
 * @returns {undefined}
 */
export const computeFromInterval = (attrs: IJobParameters): Date => {
	const previousNextRunAt = attrs.nextRunAt || new Date();
	log('[%s:%s] computing next run via interval [%s]', attrs.name, attrs._id, attrs.repeatInterval);
	const lastRun = dateForTimezone(attrs.lastRunAt || new Date(), attrs.repeatTimezone);
	let result: Date;
	try {
		const cronTime = new CronTime(attrs.repeatInterval);
		let nextDate = cronTime._getNextDateFrom(lastRun);
		if (
			nextDate.valueOf() === lastRun.valueOf() ||
			nextDate.valueOf() <= previousNextRunAt.valueOf()
		) {
			// Handle cronTime giving back the same date for the next run time
			nextDate = cronTime._getNextDateFrom(
				dateForTimezone(new Date(lastRun.valueOf() + 1000), attrs.repeatTimezone)
			);
		}

		result = nextDate;
		// Either `xo` linter or Node.js 8 stumble on this line if it isn't just ignored
	} catch (error) {
		// eslint-disable-line no-unused-vars
		// Nope, humanInterval then!
		if (!attrs.lastRunAt && humanInterval(attrs.repeatInterval)) {
			result = new Date(lastRun.valueOf());
		} else {
			result = new Date(lastRun.valueOf() + humanInterval(attrs.repeatInterval));
		}
	}

	if (!isValidDate(result)) {
		log(
			'[%s:%s] failed to calculate nextRunAt due to invalid repeat interval',
			attrs.name,
			attrs._id
		);
		throw new Error('failed to calculate nextRunAt due to invalid repeat interval');
	}

	return result;
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
	} else if (nextDate.valueOf() === lastRun.valueOf()) {
		return date('tomorrow at ', attrs.repeatAt);
	} else {
		return date(attrs.repeatAt);
	}
}
