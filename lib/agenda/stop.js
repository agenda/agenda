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
module.exports = function (timeout) {
  debug('Agenda.stop called, clearing interval for processJobs()');
  clearInterval(this._processInterval);
  this._processInterval = undefined;

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

  return Promise.resolve();
};
