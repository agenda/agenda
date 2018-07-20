'use strict';
const debug = require('debug')('agenda:maxConcurrency');

/**
 * Set the concurrency for jobs (globally), type does not matter
 * @name Agenda#maxConcurrency
 * @function
 * @param {Number} num max concurrency value
 * @returns {exports} agenda instance
 */
module.exports = function(num) {
  debug('Agenda.maxConcurrency(%d)', num);
  this._maxConcurrency = num;
  return this;
};
