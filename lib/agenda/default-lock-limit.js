'use strict';
const debug = require('debug')('agenda:defaultLockLimit');

/**
 * Set default lock limit per job type
 * @param {Number} num Lock limit per job
 * @returns {exports} agenda instance
 */
module.exports = function(num) {
  debug('Agenda.defaultLockLimit(%d)', num);
  this._defaultLockLimit = num;
  return this;
};
