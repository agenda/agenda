'use strict';
// @TODO: What should we use for internal util functions?
//        Maybe we should use agenda:util:processJobs which would move agenda:* to agenda:agenda;*
const debug = require('debug')('agenda:internal:processJobs');
const createJob = require('./create-job');

/**
 * Process methods for jobs
 * @param {Job} extraJob job to run immediately
 * @returns {undefined}
 */
module.exports = function(extraJob) {
  debug('starting to process jobs');
  // Make sure an interval has actually been set
  // Prevents race condition with 'Agenda.stop' and already scheduled run
  if (!this._processInterval) {
    debug('no _processInterval set when calling processJobs, returning');
    return;
  }

  const self = this;
  const definitions = this._definitions;
  const jobQueue = this._jobQueue;
  let jobName;

  // Determine whether or not we have a direct process call!
  if (!extraJob) {
    // Go through each jobName set in 'Agenda.process' and fill the queue with the next jobs
    for (jobName in definitions) {
      if ({}.hasOwnProperty.call(definitions, jobName)) {
        debug('queuing up job to process: [%s]', jobName);
        jobQueueFilling(jobName);
      }
    }
  } else if (definitions[extraJob.attrs.name]) {
    // Add the job to list of jobs to lock and then lock it immediately!
    debug('job [%s] was passed directly to processJobs(), locking and running immediately', extraJob.attrs.name);
    self._jobsToLock.push(extraJob);
    lockOnTheFly();
  }

  /**
   * Returns true if a job of the specified name can be locked.
   * Considers maximum locked jobs at any time if self._lockLimit is > 0
   * Considers maximum locked jobs of the specified name at any time if jobDefinition.lockLimit is > 0
   * @param {String} name name of job to check if we should lock or not
   * @returns {boolean} whether or not you should lock job
   */
  function shouldLock(name) {
    const jobDefinition = definitions[name];
    let shouldLock = true;
    if (self._lockLimit && self._lockLimit <= self._lockedJobs.length) {
      shouldLock = false;
    }

    if (jobDefinition.lockLimit && jobDefinition.lockLimit <= jobDefinition.locked) {
      shouldLock = false;
    }

    debug('job [%s] lock status: shouldLock = %s', name, shouldLock);
    return shouldLock;
  }

  /**
   * Internal method that adds jobs to be processed to the local queue
   * @param {*} jobs Jobs to queue
   * @param {boolean} inFront puts the job in front of queue if true
   * @returns {undefined}
   */
  function enqueueJobs(jobs) {
    if (!Array.isArray(jobs)) {
      jobs = [jobs];
    }

    jobs.forEach(job => {
      jobQueue.insert(job);
    });
  }

  /**
   * Internal method that will lock a job and store it on MongoDB
   * This method is called when we immediately start to process a job without using the process interval
   * We do this because sometimes jobs are scheduled but will be run before the next process time
   * @returns {undefined}
   */
  async function lockOnTheFly() {
    // Already running this? Return
    if (self._isLockingOnTheFly) {
      debug('lockOnTheFly() already running, returning');
      return;
    }

    // Don't have any jobs to run? Return
    if (self._jobsToLock.length === 0) {
      debug('no jobs to current lock on the fly, returning');
      self._isLockingOnTheFly = false;
      return;
    }

    // Set that we are running this
    self._isLockingOnTheFly = true;

    // Grab a job that needs to be locked
    const now = new Date();
    const job = self._jobsToLock.pop();

    // If locking limits have been hit, stop locking on the fly.
    // Jobs that were waiting to be locked will be picked up during a
    // future locking interval.
    if (!shouldLock(job.attrs.name)) {
      debug('lock limit hit for: [%s]', job.attrs.name);
      self._jobsToLock = [];
      self._isLockingOnTheFly = false;
      return;
    }

    // Query to run against collection to see if we need to lock it
    const criteria = {
      _id: job.attrs._id,
      lockedAt: null,
      nextRunAt: job.attrs.nextRunAt,
      disabled: {$ne: true}
    };

    // Update / options for the MongoDB query
    const update = {$set: {lockedAt: now}};
    const options = {returnOriginal: false};

    // Lock the job in MongoDB!
    const resp = await self._collection.findOneAndUpdate(criteria, update, options);

    if (resp.value) {
      const job = createJob(self, resp.value);
      debug('found job [%s] that can be locked on the fly', job.attrs.name);
      self._lockedJobs.push(job);
      definitions[job.attrs.name].locked++;
      enqueueJobs(job);
      jobProcessing();
    }

    // Mark lock on fly is done for now
    self._isLockingOnTheFly = false;

    // Re-run in case anything is in the queue
    await lockOnTheFly();
  }

  /**
   * Internal method used to fill a queue with jobs that can be run
   * @param {String} name fill a queue with specific job name
   * @returns {undefined}
   */
  async function jobQueueFilling(name) {
    // Don't lock because of a limit we have set (lockLimit, etc)
    if (!shouldLock(name)) {
      debug('lock limit reached in queue filling for [%s]', name);
      return;
    }

    // Set the date of the next time we are going to run _processEvery function
    const now = new Date();
    self._nextScanAt = new Date(now.valueOf() + self._processEvery);

    // For this job name, find the next job to run and lock it!
    try {
      const job = await self._findAndLockNextJob(name, definitions[name]);
      // Still have the job?
      // 1. Add it to lock list
      // 2. Add count of locked jobs
      // 3. Queue the job to actually be run now that it is locked
      // 4. Recursively run this same method we are in to check for more available jobs of same type!
      if (job) {
        debug('[%s:%s] job locked while filling queue', name, job.attrs._id);
        self._lockedJobs.push(job);
        definitions[job.attrs.name].locked++;
        enqueueJobs(job);
        await jobQueueFilling(name);
        jobProcessing();
      }
    } catch (error) {
      debug('[%s] job lock failed while filling queue', name, error);
    }
  }

  /**
   * Internal method that processes any jobs in the local queue (array)
   * @returns {undefined}
   */
  function jobProcessing() {
    // Ensure we have jobs
    if (jobQueue.length === 0) {
      return;
    }

    // Store for all sorts of things
    const now = new Date();

    // Get the next job that is not blocked by concurrency
    const job = jobQueue.returnNextConcurrencyFreeJob(definitions);

    debug('[%s:%s] about to process job', job.attrs.name, job.attrs._id);

    // If the 'nextRunAt' time is older than the current time, run the job
    // Otherwise, setTimeout that gets called at the time of 'nextRunAt'
    if (job.attrs.nextRunAt <= now) {
      debug('[%s:%s] nextRunAt is in the past, run the job immediately', job.attrs.name, job.attrs._id);
      runOrRetry();
    } else {
      const runIn = job.attrs.nextRunAt - now;
      debug('[%s:%s] nextRunAt is in the future, calling setTimeout(%d)', job.attrs.name, job.attrs._id, runIn);
      setTimeout(jobProcessing, runIn);
    }

    /**
     * Internal method that tries to run a job and if it fails, retries again!
     * @returns {undefined}
     */
    async function runOrRetry() {
      if (self._processInterval) {
        const job = jobQueue.pop();
        const jobDefinition = definitions[job.attrs.name];
        if (jobDefinition.concurrency > jobDefinition.running && self._runningJobs.length < self._maxConcurrency) {
          // Get the deadline of when the job is not supposed to go past for locking
          const lockDeadline = new Date(Date.now() - jobDefinition.lockLifetime);

          // This means a job has "expired", as in it has not been "touched" within the lockoutTime
          // Remove from local lock
          // NOTE: Shouldn't we update the 'lockedAt' value in MongoDB so it can be picked up on restart?
          if (job.attrs.lockedAt < lockDeadline) {
            debug('[%s:%s] job lock has expired, freeing it up', job.attrs.name, job.attrs._id);
            self._lockedJobs.splice(self._lockedJobs.indexOf(job), 1);
            jobDefinition.locked--;
            jobProcessing();
            return;
          }

          // Add to local "running" queue
          self._runningJobs.push(job);
          jobDefinition.running++;

          // CALL THE ACTUAL METHOD TO PROCESS THE JOB!!!
          debug('[%s:%s] processing job', job.attrs.name, job.attrs._id);

          job.run()
            .catch(error => [error, job])
            .then(job => processJobResult(...Array.isArray(job) ? job : [null, job])); // eslint-disable-line promise/prefer-await-to-then
        } else {
          // Run the job immediately by putting it on the top of the queue
          debug('[%s:%s] concurrency preventing immediate run, pushing job to top of queue', job.attrs.name, job.attrs._id);
          enqueueJobs(job);
        }
      }
    }
  }

  /**
   * Internal method used to run the job definition
   * @param {Error} err thrown if can't process job
   * @param {module.Job} job job to process
   * @returns {undefined}
   */
  function processJobResult(err, job) {
    if (err) {
      return job.agenda.emit('error', err);
    }

    const {name} = job.attrs;

    // Job isn't in running jobs so throw an error
    if (!self._runningJobs.includes(job)) {
      debug('[%s] callback was called, job must have been marked as complete already', job.attrs._id);
      throw new Error('callback already called - job ' + name + ' already marked complete');
    }

    // Remove the job from the running queue
    self._runningJobs.splice(self._runningJobs.indexOf(job), 1);
    if (definitions[name].running > 0) {
      definitions[name].running--;
    }

    // Remove the job from the locked queue
    self._lockedJobs.splice(self._lockedJobs.indexOf(job), 1);
    if (definitions[name].locked > 0) {
      definitions[name].locked--;
    }

    // Re-process jobs now that one has finished
    jobProcessing();
  }
};
