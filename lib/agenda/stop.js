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
module.exports = async function (timeout) {
  const self = this;

  /**
   * Internal method to unlock jobs which is locked but not running so that they can be re-run
   * @access private
   * @returns {Promise} resolves when job unlocking fails or passes
   */
  const _unlockQueuedJobs = function () {
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

        // clear the internal lock states
        for (let job of jobs) {
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

  // unlock NOT running jobs
  await _unlockQueuedJobs();

  // cancel jobs and wait if timeout is specified
  if (timeout != null) {
    return new Promise((resolve, reject) => {
      // cancel running jobs
      debug('attempt to cancel running jobs');
      let wait = [];
      for (let job of this._runningJobs) {
        if (job.isRunning()) {
          wait.push(new Promise(complete => {
            job.once('complete', complete);
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
        .then(resolve, reject)
        .then(() => clearTimeout(waitTimeout));

      // if timeout is specified and > 0, reject promise on timeout
      if (timeout > 0) {
        waitTimeout = setTimeout(() => reject(new Error('timeout')), timeout);
      }
    });
  }

  // else return;
};
