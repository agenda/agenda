'use strict';

/**
 * Set the query function used to look up other 'single' jobs.
 * @name Agenda#singlequery
 * @function
 * @param {Func} singleQuery The single query function
 * @returns {exports} agenda instance
 */
module.exports = function(singleQuery) {
  this._singleQuery = singleQuery;
  return this;
};
