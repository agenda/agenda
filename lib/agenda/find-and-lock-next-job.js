'use strict';
const debug = require('debug')('agenda:internal:_findAndLockNextJob');
const {createJob} = require('../utils');

/**
 * Find and lock jobs
 * @name Agenda#findAndLockNextJob
 * @function
 * @param {String} jobName name of job to try to lock
 * @param {Object} definition definition used to tell how job is run
 * @param {Function} cb called when job lock fails or passes
 * @access protected
 * @caller jobQueueFilling() only
 * @returns {undefined}
 */
module.exports = function(jobName, definition, cb) {
  const self = this;
  const now = new Date();
  const lockDeadline = new Date(Date.now().valueOf() - definition.lockLifetime);
  debug('_findAndLockNextJob(%s, [Function], cb)', jobName);

  /**
  * Query used to find job to run
  * @type {{$or: [*]}}
  */
  const JOB_PROCESS_WHERE_QUERY = {
    $or: [{
      name: jobName,
      lockedAt: null,
      nextRunAt: {$lte: this._nextScanAt},
      disabled: {$ne: true}
    }, {
      name: jobName,
      lockedAt: {$exists: false},
      nextRunAt: {$lte: this._nextScanAt},
      disabled: {$ne: true}
    }, {
      name: jobName,
      lockedAt: {$lte: lockDeadline},
      disabled: {$ne: true}
    }]
  };

  /**
  * Query used to set a job as locked
  * @type {{$set: {lockedAt: Date}}}
  */
  const JOB_PROCESS_SET_QUERY = {$set: {lockedAt: now}};

  /**
  * Query used to affect what gets returned
  * @type {{returnOriginal: boolean, sort: object}}
  */
  const JOB_RETURN_QUERY = {returnOriginal: false, sort: this._sort};

  // Find ONE and ONLY ONE job and set the 'lockedAt' time so that job begins to be processed
  this._collection.findOneAndUpdate(JOB_PROCESS_WHERE_QUERY, JOB_PROCESS_SET_QUERY, JOB_RETURN_QUERY, (err, result) => {
    let job;
    if (!err && result.value) {
      debug('found a job available to lock, creating a new job on Agenda with id [%s]', result.value._id);
      job = createJob(self, result.value);
    }
    if (err) {
      debug('error occurred when running query to find and lock job');
    }
    cb(err, job);
  });
};
