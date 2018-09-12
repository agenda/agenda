'use strict';
/**
 * Given a mongo connection url the function will check with a regex if it is valid
 * @param url
 * @returns {AggregationCursor|*|RegExpMatchArray|Promise<Response | undefined>}
 */
module.exports = function(url) {
  return url.match(/mongodb(?:\+srv)?:\/\/.*/) !== null;
};
