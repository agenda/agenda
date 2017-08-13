'use strict';

/**
 * Updates "lockedAt" time so the job does not get picked up again
 * @param {Function} cb called when job "touch" fails or passes
 * @returns {undefined}
 */
module.exports = function(cb) {
  this.attrs.lockedAt = new Date();
  this.save(cb);
};
