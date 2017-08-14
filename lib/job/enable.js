'use strict';

/**
 * Allows job type to run
 * @returns {exports} instance of Job
 */
module.exports = function() {
  this.attrs.disabled = false;
  return this;
};
