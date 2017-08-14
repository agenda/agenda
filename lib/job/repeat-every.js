'use strict';

/**
 * Sets a job to repeat every X amount of time
 * @param {String} interval repeat every X
 * @param {Object} options options to use for job
 * @returns {exports} instance of Job
 */
module.exports = function(interval, options) {
  options = options || {};
  this.attrs.repeatInterval = interval;
  this.attrs.repeatTimezone = options.timezone ? options.timezone : null;
  return this;
};
