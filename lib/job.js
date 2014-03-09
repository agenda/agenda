var humanInterval = require('human-interval'),
    CronTime = require('cron').CronTime,
    date = require('date.js');

var Job = module.exports = function Job(args) {
  args = args || {};
  this.agenda = args.agenda;

  var attrs = {};
  attrs._id = args._id;
  attrs.name = args.name;
  attrs.data = args.data;
  attrs.priority = parsePriority(args.priority) || 0;

  // Set some times
  attrs.lastRunAt = args.lastRunAt;
  attrs.lastFinishedAt = args.lastFinishedAt;
  attrs.nextRunAt = args.nextRunAt || new Date();

  attrs.repeatInterval = args.repeatInterval;
  attrs.type = args.type || 'once';

  this.attrs = attrs;
};

Job.prototype.toJSON=function(){ // create a persistable Mongo object -RR
    var self=this,
        attrs=self.attrs||{};
    return {
        _id:           attrs._id,
        name:          attrs.name,
        data:          attrs.data,
        priority:      attrs.priority,
        lastRunAt:     attrs.lastRunAt      ? new Date(attrs.lastRunAt)      : null,
        lastFinishedAt:attrs.lastFinishedAt ? new Date(attrs.lastFinishedAt) : null,
        nextRunAt:     attrs.nextRunAt      ? new Date(attrs.nextRunAt)      : null,
        repeatInterval:attrs.repeatInterval,
        type:          attrs.type,
        failReason:    attrs.failReason,
        failedAt:      attrs.failedAt,
        lockedAt:      attrs.lockedAt
    };
};

Job.prototype.computeNextRunAt = function() {
  var interval = this.attrs.repeatInterval;

  if(interval) {
    // Check if its a cron string
    var lastRun = this.attrs.lastRunAt || new Date();
    try {
      var cronTime = new CronTime(interval);
      var nextDate = cronTime._getNextDateFrom(lastRun);
      this.attrs.nextRunAt = nextDate;
    } catch(e) {
      // Nope, humanInterval then!
      this.attrs.nextRunAt = lastRun.valueOf() + humanInterval(interval);
    }
  } else {
    this.attrs.nextRunAt = undefined;
  }
  return this;
};

Job.prototype.repeatEvery = function(interval) {
  this.attrs.repeatInterval = interval;
  return this;
};

Job.prototype.schedule = function(time) {
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

    var jobCallback = function(err){
      if(err){
        self.fail(err);
        agenda.emit('fail', err, self);
        agenda.emit('fail:' + self.attrs.name, err, self);
      }else{
        agenda.emit('success', self);
        agenda.emit('success:' + self.attrs.name, self);
      }

      self.attrs.lastFinishedAt = new Date();
      self.attrs.lockedAt = null;
      self.save(function(saveErr, job){
        cb && cb(err || saveErr, job);
      });
    };

    try {
      agenda.emit('start', self);
      agenda.emit('start:' + self.attrs.name, self);
      if(!definition) throw new Error('Undefined job');
      if(definition.fn.length == 2) {
        definition.fn(self, jobCallback);
      } else {
        definition.fn(self);
        jobCallback();
      }
    } catch(e) {
      jobCallback(e);
    } finally {
      agenda.emit('complete', self);
      agenda.emit('complete:' + self.attrs.name, self);
    }
  });
};

Job.prototype.save = function(cb) {
  this.agenda.saveJob(this, cb);
  return this;
};

Job.prototype.remove = function(cb) {
  this.agenda._db.remove({_id: this.attrs._id}, cb);
};

function parsePriority(priority) {
  var priorityMap = {
    lowest: -20,
    low: -10,
    normal: 0,
    high: 10,
    highest: 20
  };
  if(typeof priority == 'number')
    return priority;
  else
    return priorityMap[priority];
}
