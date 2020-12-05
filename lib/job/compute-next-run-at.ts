import { Job } from './index';
import * as parser from 'cron-parser';
import humanInterval from 'human-interval';
import createDebugger from 'debug';
import moment from 'moment-timezone';
// @ts-expect-error
import date from 'date.js';

const debug = createDebugger('agenda:job');

/**
 * Internal method used to compute next time a job should run and sets the proper values
 * @name Job#computeNextRunAt
 * @function
 */
export const computeNextRunAt = function(this: Job) {
  const interval = this.attrs.repeatInterval;
  const timezone = this.attrs.repeatTimezone;
  const {repeatAt} = this.attrs;
  const previousNextRunAt = this.attrs.nextRunAt || new Date();
  this.attrs.nextRunAt = undefined;

  const dateForTimezone = (date: any) => {
    date = moment(date);
    if (timezone !== null) {
      date.tz(timezone);
    }

    return date;
  };

  /**
   * Internal method that computes the interval
   */
  const computeFromInterval = () => {
    debug('[%s:%s] computing next run via interval [%s]', this.attrs.name, this.attrs._id, interval);
    let lastRun = this.attrs.lastRunAt || new Date();
    lastRun = dateForTimezone(lastRun);
    const cronOptions: any = { currentDate: lastRun.toDate() };
    if (timezone) cronOptions.tz = timezone;
    try {
      let cronTime = parser.parseExpression(interval, cronOptions);
      let nextDate = cronTime.next().toDate();
      if (nextDate.valueOf() === lastRun.valueOf() || nextDate.valueOf() <= previousNextRunAt.valueOf()) {
        // Handle cronTime giving back the same date for the next run time
        cronOptions.currentDate = new Date(lastRun.valueOf() + 1000);
        cronTime = parser.parseExpression(interval, cronOptions);
        nextDate = cronTime.next().toDate();
      }

      this.attrs.nextRunAt = nextDate;
      debug('[%s:%s] nextRunAt set to [%s]', this.attrs.name, this.attrs._id, new Date(this.attrs.nextRunAt).toISOString());
    // Either `xo` linter or Node.js 8 stumble on this line if it isn't just ignored
    } catch (error) { // eslint-disable-line no-unused-vars
      // Nope, humanInterval then!
      try {
        if (!this.attrs.lastRunAt && humanInterval(interval)) {
          this.attrs.nextRunAt = lastRun.valueOf();
          debug('[%s:%s] nextRunAt set to [%s]', this.attrs.name, this.attrs._id, new Date(this.attrs.nextRunAt).toISOString());
        } else {
          this.attrs.nextRunAt = lastRun.valueOf() + humanInterval(interval);
          debug('[%s:%s] nextRunAt set to [%s]', this.attrs.name, this.attrs._id, new Date(this.attrs.nextRunAt).toISOString());
        }
      // Either `xo` linter or Node.js 8 stumble on this line if it isn't just ignored
      } catch (error) {} // eslint-disable-line no-unused-vars
    } finally {
      if (isNaN(this.attrs.nextRunAt)) {
        this.attrs.nextRunAt = undefined;
        debug('[%s:%s] failed to calculate nextRunAt due to invalid repeat interval', this.attrs.name, this.attrs._id);
        this.fail('failed to calculate nextRunAt due to invalid repeat interval');
      }
    }
  };

  /**
   * Internal method to compute next run time from the repeat string
   */
  const computeFromRepeatAt = () => {
    const lastRun = this.attrs.lastRunAt || new Date();
    const nextDate = date(repeatAt).valueOf();

    // If you do not specify offset date for below test it will fail for ms
    const offset = Date.now();
    if (offset === date(repeatAt, offset).valueOf()) {
      this.attrs.nextRunAt = undefined;
      debug('[%s:%s] failed to calculate repeatAt due to invalid format', this.attrs.name, this.attrs._id);
      this.fail('failed to calculate repeatAt time due to invalid format');
    } else if (nextDate.valueOf() === lastRun.valueOf()) {
      this.attrs.nextRunAt = date('tomorrow at ', repeatAt);
      debug('[%s:%s] nextRunAt set to [%s]', this.attrs.name, this.attrs._id, this.attrs.nextRunAt.toISOString());
    } else {
      this.attrs.nextRunAt = date(repeatAt);
      debug('[%s:%s] nextRunAt set to [%s]', this.attrs.name, this.attrs._id, this.attrs.nextRunAt.toISOString());
    }
  };

  if (interval) {
    computeFromInterval();
  } else if (repeatAt) {
    computeFromRepeatAt();
  }

  return this;
};
