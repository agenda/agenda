'use strict';
/**
 * Given a mongo connection url will check if it contains the mongo
 * @param {string} url URL to be tested
 * @returns {boolean} whether or not the url is a valid mongo URL
 */
module.exports = function(url) {
  return url.match(/mongodb(?:\+srv)?:\/\/.*/) !== null;
};
