'use strict';
const debug = require('debug')('agenda:schedule');

/**
 * Schedule a job or jobs at a specific time
 * @name Agenda#schedule
 * @function
 * @param {String} when when the job gets run
 * @param {Array<String>} names array of job names to run
 * @param {Object} data data to send to job
 * @returns {Promise<Job|Job[]>} job or jobs created
 */
module.exports = function(when, names, data) {
  const self = this;

  /**
   * Internal method that creates a job with given date
   * @param {String} when when the job gets run
   * @param {String} name of job to run
   * @param {Object} data data to send to job
   * @returns {Job} instance of new job
   */
  const createJob = async(when, name, data) => {
    const job = self.create(name, data);

    await job.schedule(when).save();

    return job;
  };

  /**
   * Internal helper method that calls createJob on a names array
   * @param {String} when when the job gets run
   * @param {*} names of jobs to run
   * @param {Object} data data to send to job
   * @returns {Array<Job>} jobs that were created
   */
  const createJobs = async(when, names, data) => {
    try {
      const jobs = await Promise.all(names.map(name => createJob(when, name, data)));
      debug('Agenda.schedule()::createJobs() -> all jobs created successfully');
      return jobs;
    } catch (error) {
      debug('Agenda.schedule()::createJobs() -> error creating one or more of the jobs');
      throw error;
    }
  };

  if (typeof names === 'string' || names instanceof String) {
    debug('Agenda.schedule(%s, %O, [%O], cb)', when, names);
    return createJob(when, names, data);
  }

  if (Array.isArray(names)) {
    debug('Agenda.schedule(%s, %O, [%O])', when, names);
    return createJobs(when, names, data);
  }
};
