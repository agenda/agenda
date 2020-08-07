'use strict';
const debug = require('debug')('agenda:disable');

/**
 * Disables any jobs matching the passed MongoDB query, and removes them from the database.
 * @name Agenda#disable
 * @function
 * @param {Object} query MongoDB query to use when enabling
 * @caller client code, Agenda.purge(), Job.remove()
 * @returns {Promise<Number>} A promise that contains the number of removed documents when fulfilled.
 */
module.exports = async function(query = {}) {
  debug('attempting to disable all Agenda jobs', query);
  try {
    const {result} = await this._collection.updateMany(query, {$set: {disabled: true}});
    debug('%s jobs disabled', result.n);
    return result.n;
  } catch (error) {
    debug('error trying to mark jobs as "disabled" from MongoDB');
    throw error;
  }
};
