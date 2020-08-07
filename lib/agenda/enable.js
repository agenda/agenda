'use strict';
const debug = require('debug')('agenda:enable');

/**
 * Enables any jobs matching the passed MongoDB query, and removes them from the database.
 * @name Agenda#enable
 * @function
 * @param {Object} query MongoDB query to use when enabling
 * @caller client code, Agenda.purge(), Job.remove()
 * @returns {Promise<Number>} A promise that contains the number of removed documents when fulfilled.
 */
module.exports = async function(query) {
  debug('attempting to enable all Agenda jobs', query);
  try {
    const {result} = await this._collection.updateMany(query, {$set: {disabled: false}});
    debug('%s jobs enabled', result.n);
    return result.n;
  } catch (error) {
    debug('error trying to mark jobs as "enabled" from MongoDB');
    throw error;
  }
};
