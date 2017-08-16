'use strict';
const debug = require('debug')('agenda:stop');

/**
 * Clear the interval that processes the jobs
 * @param {Function} cb called when job unlocking fails or passes
 * @returns {undefined}
 */
module.exports = function(cb) {
  const self = this;
  /**
   * Internal method to unlock jobs so that they can be re-run
   * NOTE: May need to update what properties get set here, since job unlocking seems to fail
   * @param {Function} done callback called when job unlocking fails or passes
   * @access private
   * @returns {undefined}
   */
  const _unlockJobs = function(done) {
    debug('Agenda._unlockJobs()');
    const jobIds = self._lockedJobs.map(job => job.attrs._id);

    if (jobIds.length === 0) {
      debug('no jobs to unlock');
      return done();
    }

    debug('about to unlock jobs with ids: %O', jobIds);
    self._collection.updateMany({_id: {$in: jobIds}}, {$set: {lockedAt: null}}, err => {
      if (err) {
        return done(err);
      }

      self._lockedJobs = [];
      return done();
    });
  };

  debug('Agenda.stop called, clearing interval for processJobs()');
  cb = cb || function() {};
  clearInterval(this._processInterval);
  this._processInterval = undefined;
  _unlockJobs(cb);
};
