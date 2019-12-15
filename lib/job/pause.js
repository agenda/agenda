'use strict';
const noCallback = require('../no-callback');

/**
 * Pause a job into the MongoDB
 * @name Job#
 * @function
 * @returns {Promise} instance of Job resolved after job is paused or errors
 */
module.exports = function() {
  noCallback(arguments);
  this.attrs.disabled = true;
  return this.agenda.saveJob(this);
};