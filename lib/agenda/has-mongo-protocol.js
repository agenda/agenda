'use strict';
/**
 * Given a mongo connection url will check if it contains the mongo
 * @param {string} url MongoDB connection URL
 * @returns {boolean} Validity
 */
module.exports = function(url) {
  return url.match(/mongodb(?:\+srv)?:\/\/.*/) !== null;
};
