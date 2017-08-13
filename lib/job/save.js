'use strict';

/**
 * Saves a job into the MongoDB
 * @param {Function} cb called after job is saved or errors
 * @returns {exports} instance of Job
 */
module.exports = function(cb) {
  this.agenda.saveJob(this, cb);
  return this;
};
