'use strict';

/**
 * Allows job type to run
 * @name Job#enable
 * @function
 * @returns {Job} instance of Job
 */
module.exports = function() {
  this.attrs.disabled = false;
  return this;
};
