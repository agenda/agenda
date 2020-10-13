'use strict';
const debug = require('debug')('agenda:defaultLockLimit');

/**
 * Set default lock limit per job type
 * @name Agenda#defaultLockLimit
 * @function
 * @param {Number} num Lock limit per job
 * @returns {Agenda} agenda instance
 */
module.exports = function(num) {
  debug('Agenda.defaultLockLimit(%d)', num);
  this._defaultLockLimit = num;
  return this;
};
