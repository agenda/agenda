'use strict';
const debug = require('debug')('agenda:name');

/**
 * Set name of queue
 * @name Agenda#name
 * @function
 * @param {String} name name of agenda instance
 * @returns {exports} agenda instance
 */
module.exports = function(name) {
  debug('Agenda.name(%s)', name);
  this._name = name;
  return this;
};
