'use strict';
const debug = require('debug')('agenda:now');
const noCallback = require('../no-callback');

/**
 * Create a job for this exact moment
 * @name Agenda#now
 * @function
 * @param {String} name name of job to schedule
 * @param {Object} data data to pass to job
 * @param {Function} cb called when job scheduling fails or passes
 * @returns {Job} new job instance created
 */
module.exports = async function(name, data) {
  // eslint-disable-next-line prefer-rest-params
  noCallback(arguments, 2);
  debug('Agenda.now(%s, [Object])', name);
  const job = this.create(name, data);

  job.schedule(new Date());
  await job.save();

  return job;
};
