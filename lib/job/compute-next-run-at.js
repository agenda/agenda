'use strict';
const humanInterval = require('human-interval');
const {CronTime} = require('cron');
const moment = require('moment-timezone');
const date = require('date.js');
const debug = require('debug')('agenda:job');

/**
 * Internal method used to compute next time a job should run and sets the proper values
 * @name Job#computeNextRunAt
 * @function
 * @returns {exports} instance of Job instance
 */
module.exports = function() {
  const interval = this.attrs.repeatInterval;
  const timezone = this.attrs.repeatTimezone;
  const {repeatAt} = this.attrs;
  this.attrs.nextRunAt = undefined;

  const dateForTimezone = date => {
    date = moment(date);
    if (timezone !== null) {
      date.tz(timezone);
    }
    return date;
  };

  /**
   * Internal method that computes the interval
   * @returns {undefined}
   */
  const computeFromInterval = () => {
    debug('[%s:%s] computing next run via interval [%s]', this.attrs.name, this.attrs._id, interval);
    let lastRun = this.attrs.lastRunAt || new Date();

    const startDate = this.attrs.startDate ? dateForTimezone(this.attrs.startDate) : null;
    const endDate = this.attrs.endDate ? dateForTimezone(this.attrs.endDate) : null;

    lastRun = dateForTimezone(lastRun);
    try {
      const cronTime = new CronTime(interval);
      let nextDate = cronTime._getNextDateFrom(lastRun);
      if (nextDate.valueOf() === lastRun.valueOf()) {
        // Handle cronTime giving back the same date for the next run time
        nextDate = cronTime._getNextDateFrom(dateForTimezone(new Date(lastRun.valueOf() + 1000)));
      }
      // If startDate exists, nextDate is moved after startDate
      if (startDate !== null && startDate > nextDate) {
        nextDate = cronTime._getNextDateFrom(startDate);
      }
      // If startDate exists, nextDate is moved after startDate
      if (endDate !== null && nextDate > endDate) {
        this.attrs.nextRunAt = undefined;
        this.attrs.repeatInterval = undefined;
        this.attrs.type = 'normal';
      } else {
        this.attrs.nextRunAt = nextDate;
      }

      debug('[%s:%s] nextRunAt set to [%s]', this.attrs.name, this.attrs._id, this.attrs.nextRunAt ? this.attrs.nextRunAt.toISOString() : null);
    } catch (e) {
      // Nope, humanInterval then!
      try {
        const _convertedInterval = humanInterval(interval);
        if (!this.attrs.lastRunAt && _convertedInterval) {
          this.attrs.nextRunAt = lastRun.valueOf();
        } else {
          this.attrs.nextRunAt = lastRun.valueOf() + _convertedInterval;
        }

        // Start at startDate if available
        if (startDate !== null && startDate.valueOf() > this.attrs.nextRunAt) {
          this.attrs.nextRunAt = startDate.valueOf();
        }
        // Set to null if exceeding endDate
        if (endDate !== null && this.attrs.nextRunAt > endDate.valueOf()) {
          this.attrs.nextRunAt = undefined;
          this.attrs.repeatInterval = undefined;
          this.attrs.type = 'normal';
        }

        debug('[%s:%s] nextRunAt set to [%s]', this.attrs.name, this.attrs._id, this.attrs.nextRunAt ? this.attrs.nextRunAt.toISOString() : null);
      } catch (e) { }
    } finally {
      if (this.attrs.nextRunAt !== undefined && isNaN(this.attrs.nextRunAt)) {
        this.attrs.nextRunAt = undefined;
        debug('[%s:%s] failed to calculate nextRunAt due to invalid repeat interval', this.attrs.name, this.attrs._id);
        this.fail('failed to calculate nextRunAt due to invalid repeat interval');
      }
    }
  };

  /**
   * Internal method to compute next run time from the repeat string
   * @returns {undefined}
   */
  function computeFromRepeatAt() {
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
  }

  if (interval) {
    computeFromInterval.call(this);
  } else if (repeatAt) {
    computeFromRepeatAt.call(this);
  }
  return this;
};
