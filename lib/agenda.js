/*  Code forked from https://github.com/rschmukler/agenda
 *
 *  Updates by Neville Franks neville.franks@gmail.com www.clibu.com
 *  - Refactored MongoDB code to use the MongoDB Native Driver V2 instead of MongoSkin.
 *  - Renamed _db to _collection because it is a collection, not a db.
 *  - Moved code into Agenda.db_init() and call same for all initialization functions.
 *  - Removed findJobsResultWrapper() and replaced with inline code.
 *  - Removed db code from jobs.js
 *  - Comments.
 *
 *  TODO:
 *  - Refactor remaining deprecated MongoDB Native Driver methods. findAndModify()
 *
 *  Last change: NF 4/06/2015 2:06:12 PM
 */

var Job = require('./job.js'),
  humanInterval = require('human-interval'),
  utils = require('util'),
  Emitter = require('events').EventEmitter;

var MongoClient = require('mongodb').MongoClient,
    Db = require('mongodb').Db;


var Agenda = module.exports = function(config, cb) {
  if (!(this instanceof Agenda)) {
    return new Agenda(config);
  }
  config = config ? config : {};
  this._name = config.name;
  this._processEvery = humanInterval(config.processEvery) || humanInterval('5 seconds');
  this._defaultConcurrency = config.defaultConcurrency || 5;
  this._maxConcurrency = config.maxConcurrency || 20;
  this._defaultLockLimit = config.defaultLockLimit || 0;
  this._lockLimit = config.lockLimit || 0;
  this._definitions = {};
  this._runningJobs = [];
  this._lockedJobs = [];
  this._jobQueue = [];
  this._defaultLockLifetime = config.defaultLockLifetime || 10 * 60 * 1000; //10 minute default lockLifetime

  this._isLockingOnTheFly = false;
  this._jobsToLock = [];
  if (config.mongo) {
    this.mongo(config.mongo, config.db ? config.db.collection : undefined, cb);
  } else if (config.db) {
    this.database(config.db.address, config.db.collection, config.db.options, cb);
  }
};

utils.inherits(Agenda, Emitter);    // Job uses emit() to fire job events client can use.

// Configuration Methods

Agenda.prototype.mongo = function( mdb, collection, cb ){
  this._mdb = mdb;
  this.db_init(collection, cb);   // NF 20/04/2015
  return this;
};

/** Connect to the spec'd MongoDB server and database.
 *  Notes:
 *    - If `url` inludes auth details then `options` must specify: { 'uri_decode_auth': true }. This does Auth on the specified
 *      database, not the Admin database. If you are using Auth on the Admin DB and not on the Agenda DB, then you need to
 *      authenticate against the Admin DB and then pass the MongoDB instance in to the Constructor or use Agenda.mongo().
 *    - If your app already has a MongoDB connection then use that. ie. specify config.mongo in the Constructor or use Agenda.mongo().
 */
Agenda.prototype.database = function(url, collection, options, cb) {
  if (!url.match(/^mongodb:\/\/.*/)) {
    url = 'mongodb://' + url;
  }

  collection = collection || 'agendaJobs';
  options = options || {};
  var self = this;

  MongoClient.connect(url, options, function ( error, db ){
    if (error) {
      if (cb) {
        cb(error, null);
      } else {
        throw error;
      }

      return;
    }

    self._mdb = db;
    self.db_init( collection, cb );
  });
  return this;
};

/** Setup and initialize the collection used to manage Jobs.
 *  @param collection collection name or undefined for default 'agendaJobs'
 *  NF 20/04/2015
 */
Agenda.prototype.db_init = function( collection, cb ){
  this._collection = this._mdb.collection(collection || 'agendaJobs');
  var self = this;
  this._collection.createIndexes([{
                                  "key": {"name" : 1, "priority" : -1, "lockedAt" : 1, "nextRunAt" : 1, "disabled" : 1},
                                  "name": "findAndLockNextJobIndex1"
                                }, {
                                  "key": {"name" : 1, "lockedAt" : 1, "priority" : -1, "nextRunAt" : 1, "disabled" : 1},
                                  "name": "findAndLockNextJobIndex2"
                                }],
                                function( err, result ){
                                  if (err) {
                                    self.emit('error', err);
                                  } else {
                                    self.emit('ready');
                                  }

                                  if (cb) cb(err, self._collection);
                                });
};

Agenda.prototype.name = function(name) {
  this._name = name;
  return this;
};

Agenda.prototype.processEvery = function(time) {
  this._processEvery = humanInterval(time);
  return this;
};

Agenda.prototype.maxConcurrency = function(num) {
  this._maxConcurrency = num;
  return this;
};

Agenda.prototype.defaultConcurrency = function(num) {
  this._defaultConcurrency = num;
  return this;
};

Agenda.prototype.lockLimit = function (num) {
  this._lockLimit = num;
  return this;
};

Agenda.prototype.defaultLockLimit = function (num) {
  this._defaultLockLimit = num;
  return this;
};

Agenda.prototype.defaultLockLifetime = function(ms){
  this._defaultLockLifetime = ms;
  return this;
};

// Job Methods
Agenda.prototype.create = function(name, data) {
  var priority = this._definitions[name] ? this._definitions[name].priority : 0;
  var job = new Job({name: name, data: data, type: 'normal', priority: priority, agenda: this});
  return job;
};


/** Find all Jobs matching `query` and pass same back in cb().
 *  refactored. NF 21/04/2015
 */
Agenda.prototype.jobs = function( query, cb ){
  var self = this;
  this._collection.find( query ).toArray( function( error, result ){
    var jobs;
    if( !error ){
      jobs = result.map( createJob.bind( null, self ) );
    }
    cb( error, jobs );
  });
};


Agenda.prototype.purge = function(cb) {
  var definedNames = Object.keys(this._definitions);
  this.cancel( {name: {$not: {$in: definedNames}}}, cb );   // NF refactored 21/04/2015
};

Agenda.prototype.define = function(name, options, processor) {
  if (!processor) {
    processor = options;
    options = {};
  }
  this._definitions[name] = {
    fn: processor,
    concurrency: options.concurrency || this._defaultConcurrency,
    lockLimit: options.lockLimit || this._defaultLockLimit,
    priority: options.priority || 0,
    lockLifetime: options.lockLifetime || this._defaultLockLifetime,
    running: 0,
    locked: 0
  };
};

Agenda.prototype.every = function(interval, names, data, options, cb) {
  var self = this;

  if (cb == undefined && typeof data == 'function') {
    cb = data;
    data = undefined;
  } else if (cb == undefined && typeof options == 'function') {
    cb = options;
    options = undefined;
  }

  if (typeof names === 'string' || names instanceof String) {
    return createJob(interval, names, data, options, cb);
  } else if (Array.isArray(names)) {
    return createJobs(interval, names, data, options, cb);
  }

  function createJob(interval, name, data, options, cb) {
    var job = self.create(name, data);
    job.attrs.type = 'single';
    job.repeatEvery(interval, options);
    job.computeNextRunAt();
    job.save(cb);
    return job;
  }

  function createJobs(interval, names, data, options, cb) {
    var results = [];
    var pending = names.length;
    var errored = false;
    return names.map(function (name, i) {
      return createJob(interval, name, data, options, function(err, result) {
        if (err) {
          if (!errored) cb(err);
          errored = true;
          return;
        }
        results[i] = result;
        if (--pending == 0 && cb) cb(null, results);
      });
    });

  }
};

Agenda.prototype.schedule = function(when, names, data, cb) {
  var self = this;

  if (cb == undefined && typeof data == 'function') {
    cb = data;
    data = undefined;
  }

  if (typeof names === 'string' || names instanceof String) {
    return createJob(when, names, data, cb);
  } else if (Array.isArray(names)) {
    return createJobs(when, names, data, cb);
  }


  function createJob(when, name, data, cb) {
    var job = self.create(name, data);
    job.schedule(when);
    job.save(cb);
    return job;
  }

  function createJobs(when, names, data, cb) {
    var results = [];
    var pending = names.length;
    var errored = false;
    return names.map(function (name, i) {
      return createJob(when, name, data, function(err, result) {
        if (err) {
          if (!errored) cb(err);
          errored = true;
          return;
        }
        results[i] = result;
        if (--pending == 0 && cb) cb(null, results);
      });
    });
  }
};

Agenda.prototype.now = function(name, data, cb) {
  if (!cb && typeof data == 'function') {
    cb = data;
    data = undefined;
  }
  var job = this.create(name, data);
  job.schedule(new Date());
  job.save(cb);
  return job;
};


/** Cancels any jobs matching the passed mongodb query, and removes them from the database.
 *  @param query mongo db query
 *  @param cb callback( error, numRemoved )
 *
 *  @caller client code, Agenda.purge(), Job.remove()
 */
Agenda.prototype.cancel = function(query, cb) {
  this._collection.deleteMany( query, function( error, result ){
    if (cb) {
      cb( error, result && result.result ? result.result.n : undefined );
    }
  });

};

Agenda.prototype.saveJob = function(job, cb) {
  var fn = cb,
      self = this;

  var props = job.toJSON();
  var id = job.attrs._id;
  var unique = job.attrs.unique;
  var uniqueOpts = job.attrs.uniqueOpts;

  delete props._id;
  delete props.unique;
  delete props.uniqueOpts;

  props.lastModifiedBy = this._name;

  var now = new Date(),
      protect = {},
      update = { $set: props };

  if (id) {
    this._collection.findAndModify({_id: id}, {}, update, {new: true}, processDbResult );
  } else if (props.type == 'single') {
    if (props.nextRunAt && props.nextRunAt <= now) {
      protect.nextRunAt = props.nextRunAt;
      delete props.nextRunAt;
    }
    if (Object.keys(protect).length > 0) {
      update.$setOnInsert = protect;
    }
    // Try an upsert.
    this._collection.findAndModify({name: props.name, type: 'single'}, {}, update, {upsert: true, new: true}, processDbResult);
  } else if (unique) {
    var query = job.attrs.unique;
    query.name = props.name;
    if( uniqueOpts && uniqueOpts.insertOnly )
      update = { $setOnInsert: props };
    this._collection.findAndModify(query, {}, update, {upsert: true, new: true}, processDbResult);
  } else {
    this._collection.insertOne(props, processDbResult);    // NF updated 22/04/2015
  }

  function processDbResult(err, result) {
    if (err) {
      if (fn) {
        return fn(err);
      } else {
        throw err;
      }
    } else if (result) {
      var res = result.ops ? result.ops : result.value;     // result is different for findAndModify() vs. insertOne(). NF 20/04/2015
      if ( res ){
        if (Array.isArray(res)) {
          res = res[0];
        }

        job.attrs._id = res._id;
        job.attrs.nextRunAt = res.nextRunAt;

        if (job.attrs.nextRunAt && job.attrs.nextRunAt < self._nextScanAt) {
          processJobs.call(self, job);
        }
      }
    }

    if (fn) {
      fn(null, job);
    }
  }
};

// Job Flow Methods

Agenda.prototype.start = function() {
  if (!this._processInterval) {
    this._processInterval = setInterval(processJobs.bind(this), this._processEvery);
    process.nextTick(processJobs.bind(this));
  }
};

Agenda.prototype.stop = function(cb) {
  cb = cb || function() {};
  clearInterval(this._processInterval);
  this._processInterval = undefined;
  this._unlockJobs(cb);
};

/**
 * Find and lock jobs
 * @param {String} jobName
 * @param {Function} cb
 * @protected
 *  @caller jobQueueFilling() only
 */
Agenda.prototype._findAndLockNextJob = function(jobName, definition, cb) {
  var self = this,
      now = new Date(),
      lockDeadline = new Date(Date.now().valueOf() - definition.lockLifetime);

  // Don't try and access Mongo Db if we've lost connection to it. Also see clibu_automation.js db.on.close code. NF 29/04/2015
  // Trying to resolve crash on Dev PC when it resumes from sleep.
  if (this._mdb.s.topology.connections().length === 0) {
    cb(new Error( 'No MongoDB Connection'));
  } else {
    this._collection.findAndModify(
      {
        $or: [
          {name: jobName, lockedAt: null, nextRunAt: {$lte: this._nextScanAt}, disabled: { $ne: true }},
          {name: jobName, lockedAt: {$exists: false}, nextRunAt: {$lte: this._nextScanAt}, disabled: { $ne: true }},
          {name: jobName, lockedAt: {$lte: lockDeadline}, disabled: { $ne: true }}
        ]
      },
      {'priority': -1},  // sort
      {$set: {lockedAt: now}},  // Doc
      {'new': true},  // options
      function (err, result) {
        var job;
        if (!err && result.value) {
          job = createJob(self, result.value);
        }
        cb(err, job);
      }
    );
  }
};


/**
 * Create Job object from data
 * @param {Object} agenda
 * @param {Object} jobData
 * @return {Job}
 * @private
 */
function createJob(agenda, jobData) {
  jobData.agenda = agenda;
  return new Job(jobData);
}

// Refactored to Agenda method. NF 22/04/2015
// @caller Agenda.stop() only. Could be moved into stop(). NF
Agenda.prototype._unlockJobs = function(done) {
  var jobIds = this._lockedJobs.map(function (job) {
    return job.attrs._id;
  });
  this._collection.updateMany({_id: { $in: jobIds } }, { $set: { lockedAt: null } }, done);    // NF refactored .update() 22/04/2015
};

function processJobs(extraJob) {
  if (!this._processInterval) {
    return;
  }

  var definitions = this._definitions,
    jobName,
    jobQueue = this._jobQueue,
    self = this;

  if (!extraJob) {
    for (jobName in definitions) {
      jobQueueFilling(jobName);
    }
  } else if (definitions[extraJob.attrs.name]) {
    self._jobsToLock.push(extraJob);
    lockOnTheFly();
  }

   /**
    * Returns true if a job of the specified name can be locked.
    *
    * Considers maximum locked jobs at any time if self._lockLimit is > 0
    * Considers maximum locked jobs of the specified name at any time if jobDefinition.lockLimit is > 0
    */
  function shouldLock(name) {
    var shouldLock = true;
    var jobDefinition = definitions[name];

    if(self._lockLimit && self._lockLimit <= self._lockedJobs.length) {
      shouldLock = false;
    }

    if(jobDefinition.lockLimit && jobDefinition.lockLimit <= jobDefinition.locked) {
      shouldLock = false;
    }

    return shouldLock;
  }

  function enqueueJobs(jobs, inFront) {
    if (!Array.isArray(jobs)) {
      jobs = [jobs];
    }

    jobs.forEach(function(job) {
      var jobIndex, start, loopCondition, endCondition, inc;

      if(inFront) {
        start = jobQueue.length ? jobQueue.length - 1 : 0;
        inc = -1;
        loopCondition = function () {
          return jobIndex >= 0;
        };
        endCondition = function (queuedJob) {
          return !queuedJob || queuedJob.attrs.priority < job.attrs.priority;
        };
      } else {
        start = 0;
        inc = 1;
        loopCondition = function () {
          return jobIndex < jobQueue.length;
        };
        endCondition = function (queuedJob) {
          return queuedJob.attrs.priority >= job.attrs.priority;
        };
      }

      for(jobIndex = start; loopCondition(); jobIndex += inc) {
        if(endCondition(jobQueue[jobIndex])) break;
      }

      // insert the job to the queue at its prioritized position for processing
      jobQueue.splice(jobIndex, 0, job);
    });
  }

  function lockOnTheFly() {
    if(self._isLockingOnTheFly) {
      return;
    }

    if(!self._jobsToLock.length) {
      self._isLockingOnTheFly = false;
      return;
    }

    self._isLockingOnTheFly = true;

    var now = new Date();
    var job = self._jobsToLock.pop();

    // If locking limits have been hit, stop locking on the fly.
    // Jobs that were waiting to be locked will be picked up during a
    // future locking interval.
    if(!shouldLock(job.attrs.name)) {
      self._jobsToLock = [];
      self._isLockingOnTheFly = false;
      return;
    }

    var criteria = {
      _id: job.attrs._id,
      lockedAt: null,
      nextRunAt: job.attrs.nextRunAt,
      disabled: { $ne: true }
    };

    var sort = {};
    var update = { $set: { lockedAt: now } };
    var options = { new: true };

    self._collection.findAndModify(criteria, sort, update, options, function(err, resp) {
      if (resp.value) {
        var job = createJob(self, resp.value);

        self._lockedJobs.push(job);
        definitions[job.attrs.name].locked++;

        enqueueJobs(job);
        jobProcessing();
      }
      self._isLockingOnTheFly = false;
      lockOnTheFly();
    });
  }

  function jobQueueFilling(name) {
    if(!shouldLock(name)) {
      return;
    }

    var now = new Date();
    self._nextScanAt = new Date(now.valueOf() + self._processEvery);
    self._findAndLockNextJob(name, definitions[name], function(err, job) {
      if (err) {
        throw err;
      }

      if (job) {
        self._lockedJobs.push(job);
        definitions[job.attrs.name].locked++;

        enqueueJobs(job);
        jobQueueFilling(name);
        jobProcessing();
      }
    });
  }

  function jobProcessing() {
    if (!jobQueue.length) {
      return;
    }

    var now = new Date();

    // Get the next job that is not blocked by concurrency
    var next;
    for(next = jobQueue.length - 1; next > 0; next -= 1) {
      var def = definitions[jobQueue[next].attrs.name];
      if(def.concurrency > def.running) break;
    }

    var job = jobQueue.splice(next, 1)[0],
      jobDefinition = definitions[job.attrs.name];

    if (job.attrs.nextRunAt < now) {
      runOrRetry();
    } else {
      setTimeout(runOrRetry, job.attrs.nextRunAt - now);
    }

    function runOrRetry() {
      if (self._processInterval) {
        if (jobDefinition.concurrency > jobDefinition.running &&
          self._runningJobs.length < self._maxConcurrency) {

          var lockDeadline = new Date(Date.now() - jobDefinition.lockLifetime);

          if (job.attrs.lockedAt < lockDeadline) {
            // Drop expired job
            self._lockedJobs.splice(self._lockedJobs.indexOf(job), 1);
            jobDefinition.locked--;
            jobProcessing();
            return;
          }

          self._runningJobs.push(job);
          jobDefinition.running++;
          job.run(processJobResult);
          jobProcessing();
        } else {
          // Put on top to run ASAP
          enqueueJobs(job, true);
        }
      }
    }
  }

  function processJobResult(err, job) {
    if (err && !job) throw(err)
    var name = job.attrs.name;

    self._runningJobs.splice(self._runningJobs.indexOf(job), 1);
    definitions[name].running--;

    self._lockedJobs.splice(self._lockedJobs.indexOf(job), 1);
    definitions[name].locked--;

    jobProcessing();
  }
}
