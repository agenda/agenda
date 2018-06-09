'use strict';

/**
 * Sets a job to repeat at a specific time
 * @name Job#repeatAt
 * @function
 * @param {String} time time to repeat job at (human readable or number)
 * @returns {exports} instance of Job
 */
module.exports = function(time) {
  this.attrs.repeatAt = time;
  return this;
};
