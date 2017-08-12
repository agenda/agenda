'use strict';
const debug = require('debug')('agenda:schedule');

/**
 * Schedule a job or jobs at a specific time
 * @param {String} when when the job gets run
 * @param {*} names array of job names to run
 * @param {Object} data data to send to job
 * @param {Function} cb called when schedule fails or passes
 * @returns {*} job or jobs created
 */
module.exports = function(when, names, data, cb) {
  const self = this;

  if (cb === undefined && typeof data === 'function') {
    cb = data;
    data = undefined;
  }

  /**
   * Internal method that creates a job with given date
   * @param {String} when when the job gets run
   * @param {String} name of job to run
   * @param {Object} data data to send to job
   * @param {Function} cb called when job persistence in MongoDB fails or passes
   * @returns {module.Job} instance of new job
   */
  const createJob = (when, name, data, cb) => {
    const job = self.create(name, data);
    job.schedule(when);
    job.save(cb);
    return job;
  };

  /**
   * Internal helper method that calls createJob on a names array
   * @param {String} when when the job gets run
   * @param {*} names of jobs to run
   * @param {Object} data data to send to job
   * @param {Function} cb called when job(s) persistence in MongoDB fails or passes
   * @returns {*} jobs that were created
   */
  const createJobs = (when, names, data, cb) => {
    const results = [];
    let pending = names.length;
    let errored = false;
    return names.map((name, i) => {
      return createJob(when, name, data, (err, result) => {
        if (err) {
          if (!errored) {
            cb(err);
          }
          errored = true;
          return;
        }
        results[i] = result;
        if (--pending === 0 && cb) {
          debug('Agenda.schedule()::createJobs() -> all jobs created successfully');
          cb(null, results);
        } else {
          debug('Agenda.schedule()::createJobs() -> error creating one or more of the jobs');
        }
      });
    });
  };

  if (typeof names === 'string' || names instanceof String) {
    debug('Agenda.schedule(%s, %O, [Object], cb)', when, names);
    return createJob(when, names, data, cb);
  } else if (Array.isArray(names)) {
    debug('Agenda.schedule(%s, %O, [Object], cb)', when, names);
    return createJobs(when, names, data, cb);
  }
};
