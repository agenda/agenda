'use strict';
const debug = require('debug')('agenda:purge');

/**
 * Removes all jobs from queue
 * @name Agenda#purge
 * @function
 * @param {Object} mongoOptions MongoDB options to set for job removal
 * @returns {Promise} resolved when job cancelling fails or passes
 */
module.exports = async function({session} = {}) {
  // @NOTE: Only use after defining your jobs
  const definedNames = Object.keys(this._definitions);
  debug('Agenda.purge(%o)', definedNames);
  return this.cancel({name: {$not: {$in: definedNames}}}, {session});
};
