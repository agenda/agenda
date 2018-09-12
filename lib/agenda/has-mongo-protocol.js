'use strict';
/**
 * Given a mongo connection url will check if it contains the mongo
 * @param url
 * @returns {boolean}
 */
module.exports = function(url) {
  return url.match(/mongodb(?:\+srv)?:\/\/.*/) !== null;
};
