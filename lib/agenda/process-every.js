'use strict';
const humanInterval = require('human-interval');
const debug = require('debug')('agenda:processEvery');

/**
 * Set the default process interval
 * @name Agenda#processEvery
 * @function
 * @param {Number} time time to process
 * @returns {exports} agenda instance
 */
module.exports = function(time) {
  debug('Agenda.processEvery(%d)', time);
  this._processEvery = humanInterval(time);
  return this;
};
