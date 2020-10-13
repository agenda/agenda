'use strict';

/**
 * A job is running if:
 * (lastRunAt exists AND lastFinishedAt does not exist)
 * OR
 * (lastRunAt exists AND lastFinishedAt exists but the lastRunAt is newer [in time] than lastFinishedAt)
 * @name Job#isRunning
 * @function
 * @returns {Boolean} Whether or not job is running at the moment (true for running)
 */
module.exports = function() {
  if (!this.attrs.lastRunAt) {
    return false;
  }

  if (!this.attrs.lastFinishedAt) {
    return true;
  }

  if (this.attrs.lockedAt && this.attrs.lastRunAt.getTime() > this.attrs.lastFinishedAt.getTime()) {
    return true;
  }

  return false;
};
