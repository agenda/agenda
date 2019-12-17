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

    try {
      agenda.emit('start', self);
      agenda.emit('start:' + self.attrs.name, self);
      debug('[%s:%s] starting job', self.attrs.name, self.attrs._id);
      if (!definition) {
        debug('[%s:%s] has no definition, can not run', self.attrs.name, self.attrs._id);
        throw new Error('Undefined job');
      }

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
