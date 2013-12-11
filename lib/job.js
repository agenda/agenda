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

Job.prototype.toJSON=function(){ // used to create a persistable Mongo object -RR
    var self=this, attrs=self.attrs||{};
    return {
        _id:attrs._id,
        name:attrs.name,
        data:attrs.data,
        priority:attrs.priority,
        lastRunAt:attrs.lastRunAt?(new Date(attrs.lastRunAt)).toISOString():null,
        lastFinishedAt:attrs.lastFinishedAt?(new Date(attrs.lastFinishedAt)).toISOString():null,
        nextRunAt:attrs.nextRunAt?(new Date(attrs.nextRunAt)).toISOString():null,
        repeatInterval:attrs.repeatInterval,
        type:attrs.type
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
  this.attrs.nextRunAt = date(time);
  return this;
};

Job.prototype.priority = function(priority) {
  this.attrs.priority = parsePriority(priority);
  return this;
};

Job.prototype.fail = function(reason) {
  this.attrs.failReason = reason;
  this.attrs.failedAt = new Date();
  return this;
};

Job.prototype.run = function(cb) {
  var self = this,
      agenda = self.agenda,
      definition = agenda._definitions[self.attrs.name];

  agenda._runningJobs++;
  definition.running++;

  var setImmediate = setImmediate || process.nextTick;
  setImmediate(function() {
    var now = new Date();
    self.attrs.lastRunAt = now;
    self.computeNextRunAt();
    try {
      var jobFinishedSuccessfully = function(err) {
        if(err) throw err;
        now = new Date();
        agenda._runningJobs--;
        definition.running--;
        self.attrs.lastFinishedAt = now;
        self.save(cb);
        agenda.emit('success', self);
        agenda.emit('success:' + self.attrs.name, self);
      };
      if(definition.fn.length == 2) {
        definition.fn(self, jobFinishedSuccessfully);
      } else {
        definition.fn(self);
        jobFinishedSuccessfully();
      }
    } catch(e) {
      now = new Date();
      self.fail(e.message);
      agenda._runningJobs--;
      agenda.emit('fail', e, self);
      agenda.emit('fail:' + self.attrs.name, e, self);
      definition.running--;
      self.attrs.lastFinishedAt = now;
      self.save(function(err, job) {
        if(cb)
          cb(e, job);
      });
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
