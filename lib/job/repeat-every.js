'use strict';
const debug = require('debug')('agenda:job:repeat-every');

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
  if (options.skipImmediate) {
    debug('[%s:%s] skipping immediate execution [%s]', this.attrs.name, this.attrs._id, interval);
    // Set the lastRunAt time to the nextRunAt so that the new nextRunAt will be computed in reference to the current value.
    this.attrs.lastRunAt = this.attrs.nextRunAt || new Date();
    this.computeNextRunAt();
    this.attrs.lastRunAt = undefined;
  } else {
    this.computeNextRunAt();
  }

  return this;
};
