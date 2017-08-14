'use strict';
const utils = require('../utils');

const createJob = utils.createJob;

/**
 * Finds all jobs matching 'query'
 * @param {Object} query object for MongoDB
 * @param {Function} cb called when fails or passes
 * @returns {undefined}
 */
module.exports = function(query, cb) {
  const self = this;
  this._collection.find(query).toArray((error, result) => {
    let jobs;
    if (!error) {
      jobs = result.map(createJob.bind(null, self));
    }
    cb(error, jobs);
  });
};
