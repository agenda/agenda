'use strict';
const debug = require('debug')('agenda:job');

/**
 * Internal method (RUN)
 * @param {Function} cb called when job persistence in MongoDB fails or passes
 * @returns {undefined}
 */
module.exports = function(cb) {
  const self = this;
  const agenda = self.agenda;
  const definition = agenda._definitions[self.attrs.name];

  setImmediate(() => {
    self.attrs.lastRunAt = new Date();
    debug('[%s:%s] setting lastRunAt to: %s', self.attrs.name, self.attrs._id, self.attrs.lastRunAt.toISOString());
    self.computeNextRunAt();
    self.save(() => {
      const jobCallback = function(err) {
        if (err) {
          self.fail(err);
        }

        if (!err) {
          self.attrs.lastFinishedAt = new Date();
        }
        self.attrs.lockedAt = null;
        debug('[%s:%s] job finished at [%s] and was unlocked', self.attrs.name, self.attrs._id, self.attrs.lastFinishedAt);

        self.save((saveErr, job) => {
          cb && cb(err || saveErr, job);  // eslint-disable-line no-unused-expressions
          if (err) {
            agenda.emit('fail', err, self);
            agenda.emit('fail:' + self.attrs.name, err, self);
            debug('[%s:%s] failed to be saved to MongoDB', self.attrs.name, self.attrs._id);
          } else {
            agenda.emit('success', self);
            agenda.emit('success:' + self.attrs.name, self);
            debug('[%s:%s] was saved successfully to MongoDB', self.attrs.name, self.attrs._id);
          }
          agenda.emit('complete', self);
          agenda.emit('complete:' + self.attrs.name, self);
          debug('[%s:%s] job has finished', self.attrs.name, self.attrs._id);
        });
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
          definition.fn(self, jobCallback);
        } else {
          debug('[%s:%s] process function being called', self.attrs.name, self.attrs._id);
          definition.fn(self);
          jobCallback();
        }
      } catch (err) {
        debug('[%s:%s] unknown error occurred', self.attrs.name, self.attrs._id);
        jobCallback(err);
      }
    });
  });
};
