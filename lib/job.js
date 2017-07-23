/**
 * General Notes:
 * None
 */

var humanInterval = require('human-interval'), CronTime = require('cron').CronTime, date = require('date.js'),
    moment = require('moment-timezone'), debug = require('debug')('agenda:job');

var Job = module.exports = function Job(args) {
  args = args || {};

  // Remove special args
  this.agenda = args.agenda;
  delete args.agenda;

  // Process args
  args.priority = parsePriority(args.priority) || 0;

  // Set attrs to args
  var attrs = {};
  for (var key in args) {
    if (args.hasOwnProperty(key)) {
      attrs[key] = args[key];
    }
  }

  // Set defaults if undefined
  // NOTE: What is the difference between 'once' here and 'single' in agenda.js?
  attrs.nextRunAt = attrs.nextRunAt || new Date();
  attrs.type = attrs.type || 'once';
  this.attrs = attrs;

};

/**
 * Given a job, turn it into an object we can store in Mongo
 * @returns {Object} json object from Job
 */
Job.prototype.toJSON = function() {

    var self = this, attrs = self.attrs || {};
    var result = {};

    for (var prop in attrs) {
      if (attrs.hasOwnProperty(prop)) {
        result[prop] = attrs[prop];
      }
    }

    var dates = ['lastRunAt', 'lastFinishedAt', 'nextRunAt', 'failedAt', 'lockedAt'];
    dates.forEach(function(d) {
      if (result[d]) {
        result[d] = new Date(result[d]);
      }
    });

    return result;
};

/**
 * Internal method used to compute next time a job should run and sets the proper values
 * @returns {exports} instance of Job instance
 */
Job.prototype.computeNextRunAt = function() {
  var interval = this.attrs.repeatInterval;
  var timezone = this.attrs.repeatTimezone;
  var repeatAt = this.attrs.repeatAt;
  this.attrs.nextRunAt = undefined;

  if (interval) {
    computeFromInterval.call(this);
  } else if (repeatAt) {
    computeFromRepeatAt.call(this);
  }
  return this;

  function dateForTimezone(d) {
    d = moment(d);
    if (timezone) {
        d.tz(timezone);
    }
    return d;
  }

  /**
   * Internal method that computes the interval
   * @returns {undefined}
   */
  function computeFromInterval() {

    debug('[%s:%s] computing next run via interval [%s]', this.attrs.name, this.attrs._id, interval);
    var lastRun = this.attrs.lastRunAt || new Date();
    lastRun = dateForTimezone(lastRun);
    try {
      var cronTime = new CronTime(interval);
      var nextDate = cronTime._getNextDateFrom(lastRun);
      if (nextDate.valueOf() === lastRun.valueOf()) {
        // Handle cronTime giving back the same date for the next run time
        nextDate = cronTime._getNextDateFrom(dateForTimezone(new Date(lastRun.valueOf() + 1000)));
      }
      this.attrs.nextRunAt = nextDate;
      debug('[%s:%s] nextRunAt set to [%s]', this.attrs.name, this.attrs._id, this.attrs.nextRunAt.toISOString());
    } catch (e) {
      // Nope, humanInterval then!
      try {
        if (!this.attrs.lastRunAt && humanInterval(interval)) {
          this.attrs.nextRunAt = lastRun.valueOf();
          debug('[%s:%s] nextRunAt set to [%s]', this.attrs.name, this.attrs._id, this.attrs.nextRunAt.toISOString());
        } else {
          this.attrs.nextRunAt = lastRun.valueOf() + humanInterval(interval);
          debug('[%s:%s] nextRunAt set to [%s]', this.attrs.name, this.attrs._id, this.attrs.nextRunAt.toISOString());
        }
      } catch (e) {}
    } finally {
      if (isNaN(this.attrs.nextRunAt)) {
        this.attrs.nextRunAt = undefined;
        debug('[%s:%s] failed to calculate nextRunAt due to invalid repeat interval', this.attrs.name, this.attrs._id);
        this.fail('failed to calculate nextRunAt due to invalid repeat interval');
      }
    }
  }

  /**
   * Internal method to compute next run time from the repeat string
   * @returns {undefined}
   */
  function computeFromRepeatAt() {
    var lastRun = this.attrs.lastRunAt || new Date();
    var nextDate = date(repeatAt).valueOf();

    var offset = Date.now();  // if you do not specify offset date for below test it will fail for ms
    if (offset === date(repeatAt,offset).valueOf()) {
      this.attrs.nextRunAt = undefined;
      debug('[%s:%s] failed to calculate repeatAt due to invalid format', this.attrs.name, this.attrs._id);
      this.fail('failed to calculate repeatAt time due to invalid format');
    } else if (nextDate.valueOf() === lastRun.valueOf()) {
      this.attrs.nextRunAt = date('tomorrow at ', repeatAt);
      debug('[%s:%s] nextRunAt set to [%s]', this.attrs.name, this.attrs._id, this.attrs.nextRunAt.toISOString());
    } else {
      this.attrs.nextRunAt = date(repeatAt);
      debug('[%s:%s] nextRunAt set to [%s]', this.attrs.name, this.attrs._id, this.attrs.nextRunAt.toISOString());
    }
  }
};

/**
 * Sets a job to repeat every X amount of time
 * @param {String} interval repeat every X
 * @param {Object} options options to use for job
 * @returns {exports} instance of Job
 */
Job.prototype.repeatEvery = function(interval, options) {
  options = options || {};
  this.attrs.repeatInterval = interval;
  this.attrs.repeatTimezone = options.timezone ? options.timezone : null;
  return this;
};

/**
 * Sets a job to repeat at a specific time
 * @param {String} time time to repeat job at (human readable or number)
 * @returns {exports} instance of Job
 */
Job.prototype.repeatAt = function(time) {
  this.attrs.repeatAt = time;
  return this;
};

/**
 * Prevents the job type from running
 * @returns {exports} instance of Job
 */
Job.prototype.disable = function() {
  this.attrs.disabled = true;
  return this;
};

/**
 * Allows job type to run
 * @returns {exports} instance of Job
 */
Job.prototype.enable = function() {
  this.attrs.disabled = false;
  return this;
};

/**
 * Data to ensure is unique for job to be created
 * @param {Object} unique mongo data query for unique
 * @param {Object} opts unique options
 * @returns {exports} instance of Job
 */
Job.prototype.unique = function(unique, opts) {
  this.attrs.unique = unique;
  this.attrs.uniqueOpts = opts;
  return this;
};

/**
 * Schedules a job to run at specified time
 * @param {String} time schedule a job to run "then"
 * @returns {exports} instance of Job
 */
Job.prototype.schedule = function(time) {
  this.attrs.nextRunAt = (time instanceof Date) ? time : date(time);
  return this;
};

/**
 * Sets priority of the job
 * @param {String} priority priority of when job should be queued
 * @returns {exports} instance of Job
 */
Job.prototype.priority = function(priority) {
  this.attrs.priority = parsePriority(priority);
  return this;
};

/**
 * Fails the job with a reason (error) specified
 * @param {Error|String} reason reason job failed
 * @returns {exports} instance of Job
 */
Job.prototype.fail = function(reason) {
  if (reason instanceof Error) {
    reason = reason.message;
  }
  this.attrs.failReason = reason;
  this.attrs.failCount = (this.attrs.failCount || 0) + 1;
  var now = new Date();
  this.attrs.failedAt = now;
  this.attrs.lastFinishedAt = now;
  debug('[%s:%s] fail() called [%d] times so far', this.attrs.name, this.attrs._id, this.attrs.failCount);
  return this;
};

/**
 * Internal method (RUN)
 * @param {Function} cb called when job persistence in MongoDB fails or passes
 * @returns {undefined}
 */
Job.prototype.run = function(cb) {
  var self = this,
      agenda = self.agenda,
      definition = agenda._definitions[self.attrs.name];

  var setImmediate = setImmediate || process.nextTick; // eslint-disable-line no-use-before-define
  setImmediate(function() {
    self.attrs.lastRunAt = new Date();
    debug('[%s:%s] setting lastRunAt to: %s', self.attrs.name, self.attrs._id, self.attrs.lastRunAt.toISOString());
    self.computeNextRunAt();
    self.save(function() {
      var jobCallback = function(err) {
        if (err) {
          self.fail(err);
        }

        if (!err) self.attrs.lastFinishedAt = new Date();
        self.attrs.lockedAt = null;
        debug('[%s:%s] job finished at [%s] and was unlocked', self.attrs.name, self.attrs._id, self.attrs.lastFinishedAt);

        self.save(function(saveErr, job) {
          cb && cb(err || saveErr, job);
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
      } catch (e) {
        debug('[%s:%s] unknown error occurred', self.attrs.name, self.attrs._id);
        jobCallback(e);
      }
    });
  });
};

/**
 * A job is running if:
 * (lastRunAt exists AND lastFinishedAt does not exist)
 * OR
 * (lastRunAt exists AND lastFinishedAt exists but the lastRunAt is newer [in time] than lastFinishedAt)
 * @returns {boolean} whether or not job is running at the moment (true for running)
 */
Job.prototype.isRunning = function() {
  if (!this.attrs.lastRunAt) return false;
  if (!this.attrs.lastFinishedAt) return true;
  if (this.attrs.lockedAt && this.attrs.lastRunAt.getTime() > this.attrs.lastFinishedAt.getTime()) {
    return true;
  }
  return false;
};

/**
 * Saves a job into the MongoDB
 * @param {Function} cb called after job is saved or errors
 * @returns {exports} instance of Job
 */
Job.prototype.save = function(cb) {
  this.agenda.saveJob(this, cb);
  return this;
};

/**
 * Remove the job from MongoDB
 * @param {Function} cb called when job removal fails or passes
 * @returns {undefined}
 */
Job.prototype.remove = function(cb) {
  this.agenda.cancel( {_id: this.attrs._id}, cb );
};

/**
 * Updates "lockedAt" time so the job does not get picked up again
 * @param {Function} cb called when job "touch" fails or passes
 * @returns {undefined}
 */
Job.prototype.touch = function(cb) {
  this.attrs.lockedAt = new Date();
  this.save(cb);
};

/**
 * Internal method to turn priority into a number
 * @param {String|Number} priority string to parse into number
 * @returns {Number} priority that was parsed
 */
function parsePriority(priority) {
  var priorityMap = {
    lowest: -20,
    low: -10,
    normal: 0,
    high: 10,
    highest: 20
  };
  if (typeof priority === 'number' || priority instanceof Number) {
    return priority;
  } else {
    return priorityMap[priority];
  }
}
