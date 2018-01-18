'use strict';
const {createJob} = require('../utils');

/**
 * Finds all jobs matching 'query'
 * @name Agenda#jobs
 * @function
 * @param {Object} query object for MongoDB
 * @returns {Promise} resolves when fails or passes
 */
module.exports = function(query) {
  const self = this;
  return new Promise((resolve, reject) => {
    self._collection.find(query).toArray((err, result) => {
      if (err) {
        return reject(err);
      }
      return resolve(result.map(createJob.bind(null, self)));
    });
  });
};
