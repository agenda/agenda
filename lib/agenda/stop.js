'use strict';
const debug = require('debug')('agenda:stop');

/**
 * Graceful shutdown the agenda processor
 * @name Agenda#stop
 * @function
 * @param {Number} [timeout] Specify timeout in ms to cancel all running jobs and wait for complete.
 * Specify 0 to wait indefinately, or omit the param to just clear interval only but not
 * cancelling jobs.
 * @returns {Promise} resolves when all running jobs completed, or reject if timeout
 */
module.exports = async function(timeout) {
  const self = this;

  /**
   * Internal method to unlock jobs which is locked but not running so that they can be re-run
   * @access private
   * @returns {Promise} resolves when job unlocking fails or passes
   */
  const _unlockQueuedJobs = function() {
    return new Promise((resolve, reject) => {
      debug('Agenda._unlockJobs()');
      const jobs = self._lockedJobs.filter(job => !job.isRunning());
      const jobIds = jobs.map(job => job.attrs._id);

      if (jobIds.length === 0) {
        debug('no jobs to unlock');
        return resolve();
      }

      debug('about to unlock jobs with ids: %O', jobIds);
      self._collection.updateMany({_id: {$in: jobIds}}, {$set: {lockedAt: null}}, err => {
        if (err) {
          return reject(err);
        }

        // Clear the internal lock states
        for (const job of jobs) {
          job.attrs.lockedAt = null;
          if (self._definitions[job.attrs.name]) {
            self._definitions[job.attrs.name].locked--;
          }
        }
        self._lockedJobs = self._lockedJobs.filter(x => !jobs.includes(x));
        return resolve();
      });
    });
  };

  debug('Agenda.stop called, clearing interval for processJobs()');
  clearInterval(this._processInterval);
  this._processInterval = undefined;

  // Unlock NOT running jobs
  await _unlockQueuedJobs();

  // Cancel jobs and wait if timeout is specified
  if (timeout !== null && timeout !== undefined) {
    return new Promise((resolve, reject) => {
      // Cancel running jobs
      debug('attempt to cancel running jobs');
      const wait = [];
      for (const job of this._runningJobs) {
        if (job.isRunning()) {
          wait.push(new Promise(resolve => {
            job.once('complete', resolve);
          }));
          job.cancel();
        }
      }

      if (wait.length === 0) {
        debug('no running jobs to cancel');
        return resolve();
      }

      debug('waiting for %d jobs to complete', wait.length);
      let waitTimeout;
      Promise.all(wait)
      // eslint-disable-next-line promise/prefer-await-to-then
        .then(resolve, reject)
        // eslint-disable-next-line promise/prefer-await-to-then
        .then(() => clearTimeout(waitTimeout));

      // If timeout is specified and > 0, reject promise on timeout
      if (timeout > 0) {
        waitTimeout = setTimeout(() => reject(new Error('timeout')), timeout);
      }
    });
  }

  // Else return;
};
