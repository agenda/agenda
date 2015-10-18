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
  attrs.next_run_at = attrs.next_run_at || new Date();
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

    var dates = ['last_run_at', 'last_finished_at', 'next_run_at', 'failed_at', 'locked_at'];
    dates.forEach(function(d) {
      if (result[d]) {
        if(result[d] == 'Invalid Date' || result[d] == 'NaN'){
          result[d] = null;
        }
        result[d] = new Date(result[d]);
      }
    });

    return result;
};

Job.prototype.computenext_run_at = function() {
  var interval = this.attrs.repeat_interval;
  var repeatAt = this.attrs.repeatAt;
  this.attrs.next_run_at = null; //undefined;

  if (interval) {
    computeFromInterval.call(this);
  } else if (repeatAt) {
    computeFromRepeatAt.call(this);
  }
  return this;

  function computeFromInterval() {
    var lastRun = this.attrs.last_run_at || new Date();
    try {
      var cronTime = new CronTime(interval);
      var nextDate = cronTime._getNextDateFrom(lastRun);
      if (nextDate.valueOf() == lastRun.valueOf()) {
        // Handle cronTime giving back the same date for the next run time
        nextDate = cronTime._getNextDateFrom(new Date(lastRun.valueOf() + 1000));
      }
      this.attrs.next_run_at = nextDate;
    } catch (e) {
      // Nope, humanInterval then!
      try {
        if (!this.attrs.last_run_at  && humanInterval(interval)) {
          this.attrs.next_run_at = lastRun.valueOf();
        } else {
          this.attrs.next_run_at = lastRun.valueOf() + humanInterval(interval);
        }
      } catch (e) {}
    } finally {
      if (isNaN(this.attrs.next_run_at)) {
        this.attrs.next_run_at = null; //undefined;
        this.fail('failed to calculate next_run_at due to invalid repeat interval');
      }
    }
  }

  function computeFromRepeatAt() {
    var lastRun = this.attrs.last_run_at  || new Date();
    var nextDate = date(repeatAt).valueOf();

    if (Date.now() === date(repeatAt).valueOf()) {
      this.attrs.next_run_at = undefined;
      this.fail('failed to calculate repeatAt time due to invalid format');
    } else if (nextDate.valueOf() == lastRun.valueOf()) {
      this.attrs.next_run_at = date('tomorrow at ', repeatAt);
    } else {
      this.attrs.next_run_at = date(repeatAt);
    }
  }
};

Job.prototype.repeatEvery = function(interval) {
  this.attrs.repeat_interval = interval;
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
  this.attrs.next_run_at = (time instanceof Date) ? time : date(time);
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
  this.attrs.failed_reason = reason.replace(/'/g, '');
  this.attrs.failed_at = new Date();
  return this;
};

Job.prototype.run = function(cb) {
  var self = this,
      agenda = self.agenda,
      definition = agenda._definitions[self.attrs.name];

  var setImmediate = setImmediate || process.nextTick;
  setImmediate(function() {
    self.attrs.last_run_at  = new Date();
    self.computenext_run_at();
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

        self.attrs.last_finished_at = new Date();
        self.attrs.locked_at = null;
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
  if (!this.attrs.last_run_at) return false;
  if (!this.attrs.last_finished_at) return true;
  if (this.attrs.locked_at && this.attrs.last_run_at.getTime() > this.attrs.last_finished_at.getTime()) {
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
  this.agenda._db.remove({id: this.attrs.id}, function(err, count) {
    if(err) {
      return cb(err);
    }
    cb(err, count);
  });
};

Job.prototype.touch = function(cb) {
  this.attrs.locked_at = new Date();
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
