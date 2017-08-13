'use strict';

/**
 * Prevents the job type from running
 * @returns {exports} instance of Job
 */
module.exports = function() {
  this.attrs.disabled = true;
  return this;
};
