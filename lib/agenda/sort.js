'use strict';
const debug = require('debug')('agenda:sort');

/**
 * Set the sort query for finding next job
 * Default is { nextRunAt: 1, priority: -1 }
 * @name Agenda#sort
 * @function
 * @param {Object} query sort query object for MongoDB
 * @returns {exports} agenda instance
 */
module.exports = function(query) {
  debug('Agenda.sort([Object])');
  this._sort = query;
  return this;
};
