'use strict';

/**
 * Remove the job from MongoDB
 * @name Job#remove
 * @function
 * @returns {Promise} resolves when job removal fails or passes
 */
module.exports = function() {
  return this.agenda.cancel({_id: this.attrs._id});
};
