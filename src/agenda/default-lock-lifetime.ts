'use strict';
const debug = require('debug')('agenda:defaultLockLifetime');

/**
 * Set the default lock time (in ms)
 * Default is 10 * 60 * 1000 ms (10 minutes)
 * @name Agenda#defaultLockLifetime
 * @function
 * @param {Number} ms time in ms to set default lock
 * @returns {Agenda} agenda instance
 */
module.exports = function(ms) {
  debug('Agenda.defaultLockLifetime(%d)', ms);
  this._defaultLockLifetime = ms;
  return this;
};
