'use strict';
const debug = require('debug')('agenda:purge');

/**
 * Removes all jobs from queue
 * NOTE: Only use after defining your jobs
 * @param {Function} cb called when fails or passes
 * @returns {undefined}
 */
module.exports = function(cb) {
  const definedNames = Object.keys(this._definitions);
  debug('Agenda.purge(%o)');
  this.cancel({name: {$not: {$in: definedNames}}}, cb);
};
