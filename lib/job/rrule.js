'use strict';

/**
 * Sets a job to repeat using a RRule
 * @name Job#rrule
 * @function
 * @param {Object} rrule RRule object
 * @param {Object} options options to use for job
 * @returns {Job} instance of Job
 */
module.exports = function (rrule, options = {}) {
  this.attrs.rrule = Object.assign({}, rrule);
  if (options.skipImmediate) {
    this.attrs.lastRunAt = new Date();
    this.computeNextRunAt();
    this.attrs.lastRunAt = undefined;
  }
  return this;
};
