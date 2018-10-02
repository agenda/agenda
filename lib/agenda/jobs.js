'use strict';
const {createJob} = require('../utils');

/**
 * Finds all jobs matching 'query'
 * @name Agenda#jobs
 * @function
 * @param {Object} query object for MongoDB
 * @param {Object} mongoOptions options for MongoDB
 * @returns {Promise} resolves when fails or passes
 */
module.exports = async function(query, {session} = {}) {
  const result = await this._collection.find(query, {session}).toArray();

  return result.map(job => createJob(this, job));
};
