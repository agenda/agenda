'use strict';

/**
 * Attempt to cancel a running job.
 * Note: This method does nothing if the job is not running, or has been cancelled already.
 * @name Job#cancel
 * @function
 * @returns {Job} instance of Job
 */
module.exports = function() {
  if (!this.cancelled && this.isRunning()) {
    this.cancelled = true;
    this.emit('cancel');
  }

  return this;
};
