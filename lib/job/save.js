'use strict';
const noCallback = require('../no-callback');

/**
 * Saves a job into the MongoDB
 * @name Job#
 * @function
 * @returns {Promise} instance of Job resolved after job is saved or errors
 */
module.exports = function() {
  noCallback(arguments);
  return this.agenda.saveJob(this);
};
