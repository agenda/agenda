'use strict';
const debug = require('debug')('agenda:cancel');

/**
 * Cancels any jobs matching the passed MongoDB query, and removes them from the database.
 * @name Agenda#cancel
 * @function
 * @param {Object} query MongoDB query to use when cancelling
 * @caller client code, Agenda.purge(), Job.remove()
 * @returns {Promise<Number>} A promise that contains the number of removed documents when fulfilled.
 */
module.exports = function(query) {
  debug('attempting to cancel all Agenda jobs', query);
  return this._collection.deleteMany(query).then(({result}) => {
    debug('%s jobs cancelled', result.n);
    return result.n;
  }).catch(err => {
    debug('error trying to delete jobs from MongoDB');
    throw err;
  });
};
