'use strict';

const noCallback = require('../no-callback');

/**
 * Updates "lockedAt" time so the job does not get picked up again
 * @name Job#touch
 * @function
 * @returns {undefined}
 */
module.exports = async function() {
  // eslint-disable-next-line prefer-rest-params
  noCallback(arguments);
  this.attrs.lockedAt = new Date();
  return this.save();
};
