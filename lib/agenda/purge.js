'use strict';
const debug = require('debug')('agenda:purge');

/**
 * Removes all jobs from queue
 * NOTE: Only use after defining your jobs
 * @returns {Promise}
 */
module.exports = async function() {
  const definedNames = Object.keys(this._definitions);
  debug('Agenda.purge(%o)', definedNames);
  return this.cancel({name: {$not: {$in: definedNames}}});
};
