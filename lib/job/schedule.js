'use strict';
const date = require('date.js');

/**
 * Schedules a job to run at specified time
 * @name Job#schedule
 * @function
 * @param {String} time schedule a job to run "then"
 * @returns {exports} instance of Job
 */
module.exports = function(time) {
  const d = new Date(time);

  this.attrs.nextRunAt = Number.isNaN(d.getTime()) ? date(time) : d;

  return this;
};
