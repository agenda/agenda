'use strict';
const debug = require('debug')('agenda:job');
const moment = require('moment-timezone');

/**
 * Fails the job with a reason (error) specified
 * @name Job#fail
 * @function
 * @param {Error|String} reason reason job failed
 * @returns {exports} instance of Job
 */
module.exports = function(reason) {
  if (reason instanceof Error) {
    reason = reason.message;
  }
  this.attrs.failReason = reason;
  this.attrs.failCount = (this.attrs.failCount || 0) + 1;
  const now = new Date();
  this.attrs.failedAt = now;
  this.attrs.lastFinishedAt = now;
  debug('[%s:%s] fail() called [%d] times so far', this.attrs.name, this.attrs._id, this.attrs.failCount);
  const retryCount = this.attrs.failCount - 1;
  if (retryCount <= this.attrs.maxRetries) {
    // exponential backoff formula inspired by Sidekiq
    // see:
    // https://github.com/mperham/sidekiq/wiki/Error-Handling#automatic-job-retry
    // https://github.com/mperham/sidekiq/blob/47028ef8b7cb998df6d7d72eb8af731bc6bbc341/lib/sidekiq/job_retry.rb#L225
    const waitInSeconds = Math.pow(retryCount, 4) + 15 + ((Math.random() * 30) * (retryCount + 1));
    debug('[%s:%s] retrying again in %d seconds - retry %d of %d', this.attrs.name, this.attrs._id, parseInt(waitInSeconds, 10), retryCount + 1, this.attrs.maxRetries);
    this.attrs.nextRunAt = moment().add(waitInSeconds, 'seconds').toDate();
  }
  return this;
};
