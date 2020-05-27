'use strict';
const debug = require('debug')('agenda:now');
const noCallback = require('../no-callback');

/**
 * Create a job for this exact moment
 * @name Agenda#now
 * @function
 * @param {String} name name of job to schedule
 * @param {Object} data data to pass to job
 * @returns {Promise} resolves with the new job instance created
 */
module.exports = async function(name, data) {
  debug('Agenda.now(%s, [Object])', name);
  try {
    // eslint-disable-next-line prefer-rest-params
    noCallback(arguments, 2);
    const job = this.create(name, data);

    job.schedule(new Date());
    await job.save();

    return job;
  } catch (error) {
    debug('error trying to create a job for this exact moment');
    throw error;
  }
};
