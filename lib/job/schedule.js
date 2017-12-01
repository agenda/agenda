'use strict';
const date = require('date.js');

/**
 * Schedules a job to run at specified time
 * @param {String} time schedule a job to run "then"
 * @returns {exports} instance of Job
 */
module.exports = function(time) {
  const timeHasDateType = time instanceof Date;

  if (!timeHasDateType && typeof this.agenda._getNextRunAt === 'function') {
    this.attrs.nextRunAt = this.agenda._getNextRunAt(this, time);

    return this;
  }

  this.attrs.nextRunAt = timeHasDateType ? time : date(time);
  return this;
};
