'use strict';
const debug = require('debug')('agenda:cancel');

/**
 * Cancels any jobs matching the passed MongoDB query, and removes them from the database.
 *  @param {Object} query MongoDB query to use when cancelling
 *  @caller client code, Agenda.purge(), Job.remove()
 *  @returns {Promise} resolved (numRemoved) when cancellation fails or passes
 */
module.exports = function(query) {
  return new Promise((resolve, reject) => {
    debug('attempting to cancel all Agenda jobs', query);
    this._collection.deleteMany(query, (error, {result}) => {
      if (error) {
        debug('error trying to delete jobs from MongoDB');
        return reject(error);
      }

      debug('%s jobs cancelled', result.n);
      return resolve(result.n);
    });
  });
};
