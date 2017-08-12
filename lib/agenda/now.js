'use strict';
const debug = require('debug')('agenda:now');

/**
 * Create a job for this exact moment
 * @param {String} name name of job to schedule
 * @param {Object} data data to pass to job
 * @param {Function} cb called when job scheduling fails or passes
 * @returns {module.Job} new job instance created
 */
module.exports = function(name, data, cb) {
  if (!cb && typeof data === 'function') {
    cb = data;
    data = undefined;
  }
  debug('Agenda.now(%s, [Object])', name);
  const job = this.create(name, data);
  job.schedule(new Date());
  job.save(cb);
  return job;
};
