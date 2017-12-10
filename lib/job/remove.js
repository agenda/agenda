'use strict';

/**
 * Remove the job from MongoDB
 * @returns {Promise} resolves when job removal fails or passes
 */
module.exports = function() {
  return this.agenda.cancel({_id: this.attrs._id});
};
