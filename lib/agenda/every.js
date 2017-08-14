'use strict';
const debug = require('debug')('agenda:every');

/**
 * Creates a scheduled job with given interval and name/names of the job to run
 * @param {Number} interval run every X interval
 * @param {*} names String or strings of jobs to schedule
 * @param {Object} data data to run for job
 * @param {Object} options options to run job for
 * @param {Function} cb called when schedule fails or passes
 * @returns {*} Job or jobs created
 */
module.exports = function(interval, names, data, options, cb) {
  const self = this;

  if (cb === undefined && typeof data === 'function') {
    cb = data;
    data = undefined;
  } else if (cb === undefined && typeof options === 'function') {
    cb = options;
    options = undefined;
  }

  /**
   * Internal method to setup job that gets run every interval
   * @param {Number} interval run every X interval
   * @param {*} name String job to schedule
   * @param {Object} data data to run for job
   * @param {Object} options options to run job for
   * @param {Function} cb called when schedule fails or passes
   * @returns {module.Job} instance of job
   */
  const createJob = (interval, name, data, options, cb) => {
    const job = self.create(name, data);
    job.attrs.type = 'single';
    job.repeatEvery(interval, options);
    job.computeNextRunAt();
    job.save(cb);
    return job;
  };

  /**
   * Internal helper method that uses createJob to create jobs for an array of names
   * @param {Number} interval run every X interval
   * @param {*} names Strings of jobs to schedule
   * @param {Object} data data to run for job
   * @param {Object} options options to run job for
   * @param {Function} cb called when schedule fails or passes
   * @returns {*} array of jobs created
   */
  const createJobs = (interval, names, data, options, cb) => {
    const results = [];
    let pending = names.length;
    let errored = false;
    return names.map((name, i) => {
      return createJob(interval, name, data, options, (err, result) => {
        if (err) {
          if (!errored) {
            cb(err);
          }
          errored = true;
          return;
        }
        results[i] = result;
        if (--pending === 0 && cb) {
          debug('every() -> all jobs created successfully');
          cb(null, results);
        } else {
          debug('every() -> error creating one or more of the jobs');
        }
      });
    });
  };

  if (typeof names === 'string' || names instanceof String) {
    debug('Agenda.every(%s, %O, [Object], %O, cb)', interval, names, options);
    return createJob(interval, names, data, options, cb);
  } else if (Array.isArray(names)) {
    debug('Agenda.every(%s, %s, [Object], %O, cb)', interval, names, options);
    return createJobs(interval, names, data, options, cb);
  }
};
