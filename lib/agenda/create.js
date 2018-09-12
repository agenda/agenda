'use strict';
const debug = require('debug')('agenda:create');
const Job = require('../job');

/**
 * Given a name and some data, create a new job
 * @name Agenda#create
 * @function
 * @param {String} name name of job
 * @param {Object} data data to set for job
 * @returns {Job} instance of new job
 */
module.exports = function(name, data) {
  debug('Agenda.create(%s, [Object])', name);
  const priority = this._definitions[name] ? this._definitions[name].priority : 0;
  const job = new Job({name, data, type: 'normal', priority, agenda: this});
  return job;
};
