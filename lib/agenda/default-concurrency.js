'use strict';
const debug = require('debug')('agenda:defaultConcurrency');

/**
 * Set the default concurrency for each job
 * @name Agenda#defaultConcurrency
 * @function
 * @param {Number} num default concurrency
 * @returns {exports} agenda instance
 */
module.exports = function(num) {
  debug('Agenda.defaultConcurrency(%d)', num);
  this._defaultConcurrency = num;
  return this;
};
