'use strict';

/**
 * Data to ensure is unique for job to be created
 * @name Job#unique
 * @function
 * @param {Object} unique mongo data query for unique
 * @param {Object} opts unique options
 * @returns {exports} instance of Job
 */
module.exports = function(unique, opts) {
  this.attrs.unique = unique;
  this.attrs.uniqueOpts = opts;
  return this;
};
