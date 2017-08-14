'use strict';
const debug = require('debug')('agenda:locklimit');

/**
 * Set the default amount jobs that are allowed to be locked at one time (GLOBAL)
 * NOTE: Is this different than max concurrency?
 * @param {Number} num Lock limit
 * @returns {exports} agenda instance
 */
module.exports = function(num) {
  debug('Agenda.lockLimit(%d)', num);
  this._lockLimit = num;
  return this;
};
