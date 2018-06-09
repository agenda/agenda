'use strict';
const Job = require('../job');

/**
 * Create Job object from data
 * @param {Object} agenda instance of Agenda
 * @param {Object} jobData job data
 * @returns {Job} returns created job
 */
module.exports = (agenda, jobData) => {
  jobData.agenda = agenda;
  return new Job(jobData);
};
