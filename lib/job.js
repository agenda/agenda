var humanInterval = require('human-interval'),
    CronTime = require('cron').CronTime,
    date = require('date.js');

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
  attrs.nextRunAt = attrs.nextRunAt || new Date();
  attrs.type = attrs.type || 'once';
  this.attrs = attrs;
};

Job.prototype.toJSON = function() { // create a persistable Mongo object -RR
    var self = this,
        attrs = self.attrs || {};

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

Job.prototype.computeNextRunAt = function() {
  var interval = this.attrs.repeatInterval;
  var repeatAt = this.attrs.repeatAt;
  this.attrs.nextRunAt = undefined;

  if (interval) {
    computeFromInterval.call(this);
  } else if (repeatAt) {
    computeFromRepeatAt.call(this);
  }
  return this;

  function computeFromInterval() {
    var lastRun = this.attrs.lastRunAt || new Date();
    try {
      var cronTime = new CronTime(interval);
      var nextDate = cronTime._getNextDateFrom(lastRun);
      if (nextDate.valueOf() == lastRun.valueOf()) {
        // Handle cronTime giving back the same date for the next run time
        nextDate = cronTime._getNextDateFrom(new Date(lastRun.valueOf() + 1000));
      }
      this.attrs.nextRunAt = nextDate;
    } catch (e) {
      // Nope, humanInterval then!
      try {
        if (!this.attrs.lastRunAt && humanInterval(interval)) {
          this.attrs.nextRunAt = lastRun.valueOf();
        } else {
          this.attrs.nextRunAt = lastRun.valueOf() + humanInterval(interval);
        }
      } catch (e) {}
    } finally {
      if (isNaN(this.attrs.nextRunAt)) {
        this.attrs.nextRunAt = undefined;
        this.fail('failed to calculate nextRunAt due to invalid repeat interval');
      }
    }
  }

  function computeFromRepeatAt() {
    var lastRun = this.attrs.lastRunAt || new Date();
    var nextDate = date(repeatAt).valueOf();

    if (Date.now() === date(repeatAt).valueOf()) {
      this.attrs.nextRunAt = undefined;
      this.fail('failed to calculate repeatAt time due to invalid format');
    } else if (nextDate.valueOf() == lastRun.valueOf()) {
      this.attrs.nextRunAt = date('tomorrow at ', repeatAt);
    } else {
      this.attrs.nextRunAt = date(repeatAt);
    }
  }
};

Job.prototype.repeatEvery = function(interval) {
  this.attrs.repeatInterval = interval;
  return this;
};

Job.prototype.repeatAt = function(time) {
  this.attrs.repeatAt = time;
  return this;
};

Job.prototype.disable = function() {
  this.attrs.disabled = true;
  return this;
};

Job.prototype.enable = function() {
  this.attrs.disabled = false;
  return this;
};

Job.prototype.unique = function(unique) {
  this.attrs.unique = unique;
  return this;
};

Job.prototype.schedule = function(time) {
  this._scheduled = true;
  this.attrs.nextRunAt = (time instanceof Date) ? time : date(time);
  return this;
};

Job.prototype.priority = function(priority) {
  this.attrs.priority = parsePriority(priority);
  return this;
};

Job.prototype.fail = function(reason) {
  if(reason instanceof Error) {
    reason = reason.message;
  }
  this.attrs.failReason = reason;
  this.attrs.failedAt = new Date();
  return this;
};

Job.prototype.run = function(cb) {
  var self = this,
      agenda = self.agenda,
      definition = agenda._definitions[self.attrs.name];

  var setImmediate = setImmediate || process.nextTick;
  setImmediate(function() {
    self.attrs.lastRunAt = new Date();
    self.computeNextRunAt();
    self.save(function() {
      var jobCallback = function(err) {
        if (err) {
          self.fail(err);
          agenda.emit('fail', err, self);
          agenda.emit('fail:' + self.attrs.name, err, self);
        } else {
          agenda.emit('success', self);
          agenda.emit('success:' + self.attrs.name, self);
        }

        self.attrs.lastFinishedAt = new Date();
        self.attrs.lockedAt = null;
        self.save(function(saveErr, job) {
          cb && cb(err || saveErr, job);
          agenda.emit('complete', self);
          agenda.emit('complete:' + self.attrs.name, self);
        });
      };

      try {
        agenda.emit('start', self);
        agenda.emit('start:' + self.attrs.name, self);
        if (!definition) {
          throw new Error('Undefined job');
        }
        if (definition.fn.length === 2) {
          definition.fn(self, jobCallback);
        } else {
          definition.fn(self);
          jobCallback();
        }
      } catch (e) {
        jobCallback(e);
      }
    });
  });
};

Job.prototype.isRunning = function() {
  if (!this.attrs.lastRunAt) return false;
  if (!this.attrs.lastFinishedAt) return true;
  if (this.attrs.lockedAt && this.attrs.lastRunAt.getTime() > this.attrs.lastFinishedAt.getTime()) {
    return true;
  }
  return false;
};

Job.prototype.save = function(cb) {
  this.agenda.saveJob(this, cb);
  return this;
};

Job.prototype.remove = function(cb) {
  var self = this;
  this.agenda._db.remove({_id: this.attrs._id}, function(err, count) {
    if(err) {
      return cb(err);
    }
    cb(err, count);
  });
};

Job.prototype.touch = function(cb) {
  this.attrs.lockedAt = new Date();
  this.save(cb);
};

function parsePriority(priority) {
  var priorityMap = {
    lowest: -20,
    low: -10,
    normal: 0,
    high: 10,
    highest: 20
  };
  if (typeof priority === 'number' || priority instanceof Number)
    return priority;
  else
    return priorityMap[priority];
}
