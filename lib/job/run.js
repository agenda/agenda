'use strict';
const debug = require('debug')('agenda:job');

/**
 * Internal method (RUN)
 * @name Job#run
 * @function
 * @returns {Promise} Resolves when job persistence in MongoDB fails or passes
 */
module.exports = function() {
  const self = this;
  const {agenda} = self;
  const definition = agenda._definitions[self.attrs.name];

  // @TODO: this lint issue should be looked into: https://eslint.org/docs/rules/no-async-promise-executor
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async(resolve, reject) => {
    self.attrs.lastRunAt = new Date();
    debug('[%s:%s] setting lastRunAt to: %s', self.attrs.name, self.attrs._id, self.attrs.lastRunAt.toISOString());
    self.computeNextRunAt();
    await self.save();

    let lockTimeout = null;
    let finished = false;
    const jobCallback = async err => {
      // We don't want to complete the job multiple times
      if (finished) {
        return;
      }

      finished = true;

      if (err) {
        self.fail(err);
      } else {
        self.attrs.lastFinishedAt = new Date();
      }

      clearLockExpiryTimer();

      self.attrs.lockedAt = null;

      await self.save().catch(error => {
        debug('[%s:%s] failed to be saved to MongoDB', self.attrs.name, self.attrs._id);
        reject(error);
      });
      debug('[%s:%s] was saved successfully to MongoDB', self.attrs.name, self.attrs._id);

      if (err) {
        agenda.emit('fail', err, self);
        agenda.emit('fail:' + self.attrs.name, err, self);
        debug('[%s:%s] has failed [%s]', self.attrs.name, self.attrs._id, err.message);
      } else {
        agenda.emit('success', self);
        agenda.emit('success:' + self.attrs.name, self);
        debug('[%s:%s] has succeeded', self.attrs.name, self.attrs._id);
      }

      agenda.emit('complete', self);
      agenda.emit('complete:' + self.attrs.name, self);
      debug('[%s:%s] job finished at [%s] and was unlocked', self.attrs.name, self.attrs._id, self.attrs.lastFinishedAt);
      // Curiously, we still resolve successfully if the job processor failed.
      // Agenda is not equipped to handle errors originating in user code, so, we leave them to inspect the side-effects of job.fail()
      resolve(self);
    };

    const expireCallback = function() {
      clearLockExpiryTimer();

      // On release, we just want to remove the job from our internal
      // structures. Therefore, we bypass the save entirely and just call
      // the callback/emit events
      resolve(self);

      agenda.emit('expire', self);
      agenda.emit('expire:' + self.attrs.name, self);
      agenda.emit('complete', self);
      agenda.emit('complete:' + self.attrs.name, self);
      debug('[%s:%s] job has been released', self.attrs.name, self.attrs._id);
    };

    function clearLockExpiryTimer() {
      // We are done processing the job and can clear out the lock timer we
      // created, in addition to removing it from the list of timers we're
      // tracking.
      clearTimeout(lockTimeout);
      if (lockTimeout !== null && agenda._lockExpirationTimers.indexOf(lockTimeout) !== -1) {
        agenda._lockExpirationTimers.splice(agenda._lockExpirationTimers.indexOf(lockTimeout), 1);
      }
    }

    // Watches for the job expiring
    function setLockTimeout(deadline) {
      // If we were tracking an old timer, clear it out
      if (lockTimeout !== null && agenda._lockExpirationTimers.indexOf(lockTimeout) !== -1) {
        agenda._lockExpirationTimers.splice(agenda._lockExpirationTimers.indexOf(lockTimeout), 1);
      }

      lockTimeout = setTimeout(() => {
        // The lock time could have changed due to touch(), so verify that it is
        // still valid
        const updatedDeadline = new Date(Date.now() - definition.lockLifetime);
        if (self.attrs.lockedAt < updatedDeadline) {
          // The lock has expired. Treat this as an implicit fail, but don't
          // prevent the job from being redelivered.

          // We check the current nextRunAt. If it is later than now, update
          // the job to run now instead so that it can be redelivered. If the
          // nextRunAt is before now, we leave it as is because it will be
          // redelivered anyway.
          if (!self.attrs.nextRunAt || self.attrs.nextRunAt > new Date()) {
            self.schedule(new Date());
          }

          debug('[%s:%s] lock expired while processing', self.attrs.name, self.attrs._id);
          expireCallback();
        } else {
          // The lock isn't expired yet. Set another timeout with the updated time
          setLockTimeout(updatedDeadline);
        }
      }, self.attrs.lockedAt - deadline);

      // Add our new timer to the list of lock expiration timers
      agenda._lockExpirationTimers.push(lockTimeout);
    }

    try {
      agenda.emit('start', self);
      agenda.emit('start:' + self.attrs.name, self);
      debug('[%s:%s] starting job', self.attrs.name, self.attrs._id);
      if (!definition) {
        debug('[%s:%s] has no definition, can not run', self.attrs.name, self.attrs._id);
        throw new Error('Undefined job');
      }

      // Set the initial lock expiration timeout
      setLockTimeout(new Date(Date.now() - definition.lockLifetime));

      if (definition.fn.length === 2) {
        debug('[%s:%s] process function being called', self.attrs.name, self.attrs._id);
        await definition.fn(self, jobCallback);
      } else {
        debug('[%s:%s] process function being called', self.attrs.name, self.attrs._id);
        await definition.fn(self);
        await jobCallback();
      }
    } catch (error) {
      debug('[%s:%s] unknown error occurred', self.attrs.name, self.attrs._id);
      await jobCallback(error);
    }
  });
};
