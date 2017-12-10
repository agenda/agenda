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
module.exports = function(when, names, data) {
  const self = this;

  /**
   * Internal method that creates a job with given date
   * @param {String} when when the job gets run
   * @param {String} name of job to run
   * @param {Object} data data to send to job
   * @returns {module.Job} instance of new job
   */
  const createJob = (when, name, data) => {
    return new Promise(async resolve => {
      const job = self.create(name, data);
      job.schedule(when);
      job.save();
      return resolve(job);
    });
  };

  /**
   * Internal helper method that calls createJob on a names array
   * @param {String} when when the job gets run
   * @param {*} names of jobs to run
   * @param {Object} data data to send to job
   * @returns {*} jobs that were created
   */
  const createJobs = (when, names, data) => {
    return new Promise((resolve, reject) => {
      try {
        const jobs = names.map(name => createJob(when, name, data));
        debug('Agenda.schedule()::createJobs() -> all jobs created successfully');
        return resolve(jobs);
      } catch (err) {
        debug('Agenda.schedule()::createJobs() -> error creating one or more of the jobs');
        return reject(err);
      }
    });
  };

  if (typeof names === 'string' || names instanceof String) {
    debug('Agenda.schedule(%s, %O, [%O], cb)', when, names);
    return createJob(when, names, data);
  } else if (Array.isArray(names)) {
    debug('Agenda.schedule(%s, %O, [%O])', when, names);
    return createJobs(when, names, data);
  }
};
