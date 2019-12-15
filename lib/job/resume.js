'use strict';
const date = require('date.js');

/**
 * Resumes a job into the MongoDB
 * @name Job#
 * @function
 * @param when time for the new nextRunAt field
 * @returns {Promise} instance of Job that is resumed
 */
module.exports = function(when) {
  const d = new Date(when);
  this.attrs.disabled = false;
  this.attrs.nextRunAt = Number.isNaN(d.getTime()) ? date(when) : d;
  return this;
};
