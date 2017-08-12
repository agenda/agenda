'use strict';
const debug = require('debug')('agenda:cancel');

/**
 * Cancels any jobs matching the passed MongoDB query, and removes them from the database.
 *  @param {Object} query MongoDB query to use when cancelling
 *  @param {Function} cb callback(error, numRemoved) when cancellation fails or passes
 *  @caller client code, Agenda.purge(), Job.remove()
 *  @returns {undefined}
 */
module.exports = function(query, cb) {
  debug('attempting to cancel all Agenda jobs', query);
  this._collection.deleteMany(query, (error, result) => {
    if (cb) {
      if (error) {
        debug('error trying to delete jobs from MongoDB');
      } else {
        debug('jobs cancelled');
      }
      cb(error, result && result.result ? result.result.n : undefined);
    }
  });
};
