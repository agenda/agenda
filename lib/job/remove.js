'use strict';

/**
 * Remove the job from MongoDB
 * @param {Function} cb called when job removal fails or passes
 * @returns {undefined}
 */
module.exports = function(cb) {
  this.agenda.cancel({_id: this.attrs._id}, cb);
};
