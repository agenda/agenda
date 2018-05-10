'use strict';
const debug = require('debug')('agenda:isReady');

/**
 *  Check if agenda is correctly initialized
 *  @returns {boolean} is ready
 */
module.exports = function() {
  debug('checking if agenda is correctly initialized');
  if (!this._isReady) {
    debug('agenda is not ready yet');
    return false;
  }

  return true;
};
