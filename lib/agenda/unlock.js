'use strict';
const debug = require('debug')('agenda:unlock');

/**
 * Stops processing new jobs and unlocks all currently locked jobs. This is useful when you want
 * to terminate agenda immediately after {@link Agenda#stop} has been timed out.
 *
 * NOTE:
 * This method only unlocks jobs. It does NOT cancel currently running jobs.
 * Any running processors may still be able to update the job attrs directly to the database.
 * @name Agenda#unlock
 * @function
 * @returns {Promise} resolves when all jobs unlocked, or reject if error
 */
module.exports = async function() {
  const self = this;
  /**
   * Internal method to unlock jobs so that they can be re-run
   * NOTE: May need to update what properties get set here, since job unlocking seems to fail
   * @access private
   * @returns {Promise} resolves when job unlocking fails or passes
   */
  const _unlockJobs = function() {
    return new Promise((resolve, reject) => {
      debug('Agenda._unlockJobs()');
      const jobIds = self._lockedJobs.map(job => job.attrs._id);
      const MIN_DATE = new Date(-8640000000000000);

      if (jobIds.length === 0) {
        debug('no jobs to unlock');
        return resolve();
      }

      debug('about to unlock jobs with ids: %O', jobIds);
      // In order to let the jobs to be re-run, we expires the lock instead of removing it.
      self._collection.updateMany(
        {_id: {$in: jobIds}},
        {$set: {lockedAt: MIN_DATE}},
        err => {
          if (err) {
            return reject(err);
          }

          // Clear the internal lock states
          for (const job of self._lockedJobs) {
            job.attrs.lockedAt = MIN_DATE;
          }

          for (const def of Object.values(self._definitions)) {
            def.locked = 0;
          }

          self._lockedJobs = [];
          return resolve();
        });
    });
  };

  debug('Agenda.unlock called, stopping processor and unlocking all jobs');
  await this.stop();

  return _unlockJobs();
};
