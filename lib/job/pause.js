'use strict';
/**
 * Pause a job into the MongoDB
 * @name Job#
 * @function
 * @returns {Promise} instance of Job resolved after job is paused or errors
 */
module.exports = function() {
  this.attrs.disabled = true;
  return this.save();
};
