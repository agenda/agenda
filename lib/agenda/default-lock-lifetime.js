'use strict';
const debug = require('debug')('agenda:defaultLockLifetime');

/**
 * Set the default lock time (in ms)
 * Default is 10 * 60 * 1000 ms (10 minutes)
 * @param {Number} ms time in ms to set default lock
 * @returns {exports} agenda instance
 */
module.exports = function(ms) {
  debug('Agenda.defaultLockLifetime(%d)', ms);
  this._defaultLockLifetime = ms;
  return this;
};
