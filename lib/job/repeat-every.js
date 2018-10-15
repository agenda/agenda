'use strict';
const date = require('date.js');

/**
 * Sets a job to repeat every X amount of time
 * @name Job#repeatEvery
 * @function
 * @param {String} interval repeat every X
 * @param {Object} options options to use for job
 * @returns {Job} instance of Job
 */
module.exports = function(interval, options) {
  options = options || {};
  this.attrs.repeatInterval = interval;
  this.attrs.repeatTimezone = options.timezone ? options.timezone : null;

  /**
   * Options to handle start and end date constraints in repeatEvery
   */
  const startDate = options.startDate;
  const endDate = options.endDate;
  this.attrs.startDate = startDate
    ? startDate instanceof Date
      ? startDate
      : date(startDate)
    : null;
  this.attrs.endDate = endDate
    ? endDate instanceof Date
      ? endDate
      : date(endDate)
    : null;
  if (options.skipImmediate) {
    this.attrs.lastRunAt = new Date();
    this.computeNextRunAt();
    this.attrs.lastRunAt = undefined;
  }
  return this;
};
