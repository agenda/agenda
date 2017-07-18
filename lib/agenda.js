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
  this._defaultLockLifetime = config.defaultLockLifetime || 10 * 60 * 1000; // 10 minute default lockLifetime

  this._isLockingOnTheFly = false;
  this._jobsToLock = [];
  if (config.mongo) {
    this.mongo(config.mongo, config.db ? config.db.collection : undefined, cb);
  } else if (config.db) {
    this.database(config.db.address, config.db.collection, config.db.options, cb);
  }
};

utils.inherits(Agenda, Emitter); // Job uses emit() to fire job events client can use.

// Configuration Methods

Agenda.prototype.mongo = function( mdb, collection, cb ){
  this._mdb = mdb;
  this.db_init(collection, cb); // NF 20/04/2015
  return this;
};

/**
 * Connect to the spec'd MongoDB server and database.
 * @param {String} url mongodb server URL
 * @param {String} collection name of collection to use
 * @param {Object} options options for connecting
 * @param {Function} cb callback of mongo connection
 * @returns {exports}
 *  Notes:
 *    - If `url` includes auth details then `options` must specify: { 'uri_decode_auth': true }. This does Auth on the specified
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

  MongoClient.connect(url, options, function( error, db ){
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

/**
 * Setup and initialize the collection used to manage Jobs.
 * @param {Object} collection name or undefined for default 'agendaJobs'
 * @param {Function} cb called when the db is initialized
 * @returns {undefined}
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
  }], function( err, result ){
    handleLegacyCreateIndex(err, result, self, cb)
  });
};

/**
 * Internal method called if new indices have an error
 * @param {Error} err error returned from index creation from before
 * @param {*} result result passed in from earlier attempt of creating index
 * @param {Agenda} self instance of Agenda
 * @param {Function} cb called when indices fail or work
 * @returns {undefined}
 */
function handleLegacyCreateIndex(err, result, self, cb){
  if (err && err.message !== 'no such cmd: createIndexes'){
    self.emit('error', err);
  } else {
    // Looks like a mongo.version < 2.4.x
    err = null;
    self._collection.ensureIndex(
        {"name": 1, "priority": -1, "lockedAt": 1, "nextRunAt": 1, "disabled": 1},
        {name: "findAndLockNextJobIndex1"}
    );
    self._collection.ensureIndex(
        {"name": 1, "lockedAt": 1, "priority": -1, "nextRunAt": 1, "disabled": 1},
        {name: "findAndLockNextJobIndex2"}
    );
    self.emit('ready');
  }
  if (cb){
    cb(err, self._collection);
  }
}

/**
 * Set name of "queue" worker
 * @param {String} name name of agenda instance (worker)
 * @returns {exports} agenda instance
 */
Agenda.prototype.name = function(name) {
  this._name = name;
  return this;
};

/**
 * Set the default process interval
 * @param {Number} time time to process
 * @returns {exports} agenda instance
 */
Agenda.prototype.processEvery = function(time) {
  this._processEvery = humanInterval(time);
  return this;
};

/**
 * Set the concurrency for jobs (globally), type does not matter
 * @param {Number} num max concurrency value
 * @returns {exports} agenda instance
 */
Agenda.prototype.maxConcurrency = function(num) {
  this._maxConcurrency = num;
  return this;
};

/**
 * Set the default concurrency for each job
 * @param {Number} num default concurrency
 * @returns {exports} agenda instance
 */
Agenda.prototype.defaultConcurrency = function(num) {
  this._defaultConcurrency = num;
  return this;
};

/**
 * Set the default amount jobs that are allowed to be locked at one time (GLOBAL)
 * NOTE: Is this different than max concurrency?
 * @param {Number} num Lock limit
 * @returns {exports} agenda instance
 */
Agenda.prototype.lockLimit = function(num) {
  this._lockLimit = num;
  return this;
};

/**
 * Set default lock limit per job type
 * @param {Number} num Lock limit per job
 * @returns {exports} agenda instance
 */
Agenda.prototype.defaultLockLimit = function(num) {
  this._defaultLockLimit = num;
  return this;
};

/**
 * Set the default lock time (in ms)
 * Default is 10 * 60 * 1000 ms (10 minutes)
 * @param {Number} ms time in ms to set default lock
 * @returns {exports} agenda instance
 */
Agenda.prototype.defaultLockLifetime = function(ms){
  this._defaultLockLifetime = ms;
  return this;
};

/**
 * Given a name and some data, create a new job
 * @param {String} name name of job
 * @param {Object} data data to set for job
 * @access protected
 * @returns {module.Job} instance of new job
 */
Agenda.prototype.create = function(name, data) {
  var priority = this._definitions[name] ? this._definitions[name].priority : 0;
  var job = new Job({name: name, data: data, type: 'normal', priority: priority, agenda: this});
  return job;
};


/**
 * Finds all jobs matching 'query'
 * @param {Object} query object for Mongo
 * @param {Function} cb called with result or error
 * @returns {undefined}
 */
Agenda.prototype.jobs = function( query, cb ){
  var self = this;
  this._collection.find( query ).toArray( function( error, result ){
    var jobs;
    if ( !error ){
      jobs = result.map( createJob.bind( null, self ) );
    }
    cb( error, jobs );
  });
};

/**
 * Removes all jobs from queue
 * NOTE: Only use after defining your jobs
 * @param {Function} cb called when done or error
 * @returns {undefined}
 */
Agenda.prototype.purge = function(cb) {
  var definedNames = Object.keys(this._definitions);
  this.cancel( {name: {$not: {$in: definedNames}}}, cb );
};

/**
 * Setup definition for job
 * Method is used by consumers of lib to setup their functions
 * @param {String} name name of job
 * @param {Object} options options for job to run
 * @param {Function} processor function to be called to run actual job
 * @returns {undefined}
 */
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

/**
 * Creates a scheduled job with given interval and name/names of the job to run
 * @param {Number} interval run every X interval
 * @param {*} names String or strings of jobs to schedule
 * @param {Object} data data to run for job
 * @param {Object} options options to run job for
 * @param {Function} cb called when schedule is done for failed
 * @returns {*} Job or jobs created
 */
Agenda.prototype.every = function(interval, names, data, options, cb) {
  var self = this;

  if (cb === undefined && typeof data === 'function') {
    cb = data;
    data = undefined;
  } else if (cb === undefined && typeof options === 'function') {
    cb = options;
    options = undefined;
  }

  if (typeof names === 'string' || names instanceof String) {
    return createJob(interval, names, data, options, cb);
  } else if (Array.isArray(names)) {
    return createJobs(interval, names, data, options, cb);
  }

  /**
   * Internal method to setup job that gets run every interval
   * @param {Number} interval run every X interval
   * @param {*} name String job to schedule
   * @param {Object} data data to run for job
   * @param {Object} options options to run job for
   * @param {Function} cb called when schedule is done for failed
   * @returns {module.Job} instance of job
   */
  function createJob(interval, name, data, options, cb) {
    var job = self.create(name, data);
    job.attrs.type = 'single';
    job.repeatEvery(interval, options);
    job.computeNextRunAt();
    job.save(cb);
    return job;
  }

  /**
   * Internal helper method that uses createJob to create jobs for an array of names
   * @param {Number} interval run every X interval
   * @param {*} names Strings of jobs to schedule
   * @param {Object} data data to run for job
   * @param {Object} options options to run job for
   * @param {Function} cb called when schedule is done for failed
   * @returns {*} array of jobs created
   */
  function createJobs(interval, names, data, options, cb) {
    var results = [];
    var pending = names.length;
    var errored = false;
    return names.map(function(name, i) {
      return createJob(interval, name, data, options, function(err, result) {
        if (err) {
          if (!errored) cb(err);
          errored = true;
          return;
        }
        results[i] = result;
        if (--pending === 0 && cb) cb(null, results);
      });
    });

  }
};

/**
 * Schedule a job or jobs at a specific time
 * @param {String} when when the job gets run
 * @param {*} names array of job names to run
 * @param {Object} data data to send to job
 * @param {Function} cb called when job has been scheduled
 * @returns {*} Job or jobs created
 */
Agenda.prototype.schedule = function(when, names, data, cb) {
  var self = this;

  if (cb === undefined && typeof data === 'function') {
    cb = data;
    data = undefined;
  }

  if (typeof names === 'string' || names instanceof String) {
    return createJob(when, names, data, cb);
  } else if (Array.isArray(names)) {
    return createJobs(when, names, data, cb);
  }

  /**
   * Internal method that creates a job with given date
   * @param {String} when when the job gets run
   * @param {String} name of job to run
   * @param {Object} data data to send to job
   * @param {Function} cb called when job has been scheduled
   * @returns {module.Job} Instace of new job
   */
  function createJob(when, name, data, cb) {
    var job = self.create(name, data);
    job.schedule(when);
    job.save(cb);
    return job;
  }

  /**
   * Internal helper method that calls createJob on a names array
   * @param {String} when when the job gets run
   * @param {*} names of jobs to run
   * @param {Object} data data to send to job
   * @param {Function} cb called when job has been scheduled
   * @returns {*} Jobs that were created
   */
  function createJobs(when, names, data, cb) {
    var results = [];
    var pending = names.length;
    var errored = false;
    return names.map(function(name, i) {
      return createJob(when, name, data, function(err, result) {
        if (err) {
          if (!errored) cb(err);
          errored = true;
          return;
        }
        results[i] = result;
        if (--pending === 0 && cb) cb(null, results);
      });
    });
  }
};

/**
 * Create a job for this exact moment
 * @param {String} name name of job to schedule
 * @param {Object} data data to pass to job
 * @param {Function} cb called when job has been scheduled
 * @returns {module.Job} new job instance created
 */
Agenda.prototype.now = function(name, data, cb) {
  if (!cb && typeof data === 'function') {
    cb = data;
    data = undefined;
  }
  var job = this.create(name, data);
  job.schedule(new Date());
  job.save(cb);
  return job;
};


/**
 * Cancels any jobs matching the passed mongodb query, and removes them from the database.
 *  @param {Object} query mongo db query
 *  @param {Function} cb callback(error, numRemoved)
 *  @caller client code, Agenda.purge(), Job.remove()
 *  @returns {undefined}
 */
Agenda.prototype.cancel = function(query, cb) {
  this._collection.deleteMany( query, function( error, result ){
    if (cb) {
      cb( error, result && result.result ? result.result.n : undefined );
    }
  });
};

/**
 * Save the properties on a job to MongoDB
 * @param {module.Job} job job to save into mongo
 * @param {Function} cb called when job is saved or errors
 * @returns {undefined}
 */
Agenda.prototype.saveJob = function(job, cb) {

  var fn = cb, self = this;
  var props = job.toJSON();
  var id = job.attrs._id;
  var unique = job.attrs.unique;
  var uniqueOpts = job.attrs.uniqueOpts;

  delete props._id;
  delete props.unique;
  delete props.uniqueOpts;

  props.lastModifiedBy = this._name;

  var now = new Date(), protect = {}, update = { $set: props };

  if (id) {
    this._collection.findOneAndUpdate({_id: id}, update, {returnOriginal: false}, processDbResult );
  } else if (props.type === 'single') {
    if (props.nextRunAt && props.nextRunAt <= now) {
      protect.nextRunAt = props.nextRunAt;
      delete props.nextRunAt;
    }
    if (Object.keys(protect).length > 0) {
      update.$setOnInsert = protect;
    }
    // Try an upsert.
    this._collection.findOneAndUpdate({name: props.name, type: 'single'}, update, {upsert: true, returnOriginal: false}, processDbResult);
  } else if (unique) {
    var query = job.attrs.unique;
    query.name = props.name;
    if ( uniqueOpts && uniqueOpts.insertOnly )
      update = { $setOnInsert: props };
    this._collection.findOneAndUpdate(query, update, {upsert: true, returnOriginal: false}, processDbResult);
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

/**
 * Starts processing jobs using processJobs() methods, storing an interval ID
 * @returns {undefined}
 */
Agenda.prototype.start = function() {
  if (!this._processInterval) {
    this._processInterval = setInterval(processJobs.bind(this), this._processEvery);
    process.nextTick(processJobs.bind(this));
  }
};

/**
 * Clear the interval that processes the jobs
 * @param {Function} cb called when jobs have been unlocked
 * @returns {undefined}
 */
Agenda.prototype.stop = function(cb) {
  cb = cb || function() {};
  clearInterval(this._processInterval);
  this._processInterval = undefined;
  this._unlockJobs(cb);
};

/**
 * Find and lock jobs
 * @param {String} jobName name of job to try to lock
 * @param {Object} definition definition used to tell how job is run
 * @param {Function} cb called when job is locked or errors
 * @access protected
 * @caller jobQueueFilling() only
 * @returns {undefined}
 */
Agenda.prototype._findAndLockNextJob = function(jobName, definition, cb) {

  var self = this, now = new Date(), lockDeadline = new Date(Date.now().valueOf() - definition.lockLifetime);

  // Don't try and access Mongo Db if we've lost connection to it.
  // Trying to resolve crash on Dev PC when it resumes from sleep. NOTE: Does this still happen?
  var s = this._mdb.s || this._mdb.db.s;
  if (s.topology.connections().length === 0) {
    cb(new Error('No MongoDB Connection'));
  } else {

    /**
    * Query used to find job to run
    * @type {{$or: [*]}}
    */
    var JOB_PROCESS_WHERE_QUERY = {
      $or: [
          { name: jobName, lockedAt: null, nextRunAt: { $lte: this._nextScanAt }, disabled: { $ne: true } },
          { name:        jobName,
              lockedAt:  { $exists: false },
              nextRunAt: { $lte: this._nextScanAt },
              disabled:  { $ne: true }
          },
          { name: jobName, lockedAt: { $lte: lockDeadline }, disabled: { $ne: true } }
      ]
    };

    /**
    * Query used to set a job as locked
    * @type {{$set: {lockedAt: Date}}}
    */
    var JOB_PROCESS_SET_QUERY = { $set: { lockedAt: now } };

    /**
    * Query used to affect what gets returned
    * @type {{returnOriginal: boolean, priority: number}}
    */
    var JOB_RETURN_QUERY = { returnOriginal: false, 'priority': -1 };

    // Find ONE and ONLY ONE job and set the 'lockedAt' time so that job begins to be processed
    this._collection.findOneAndUpdate(JOB_PROCESS_WHERE_QUERY, JOB_PROCESS_SET_QUERY, JOB_RETURN_QUERY,
        function(err, result) {
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
 * @param {Object} agenda instance of Agenda
 * @param {Object} jobData job data
 * @returns {module.Job} Returns created job
 */
function createJob(agenda, jobData) {
  jobData.agenda = agenda;
  return new Job(jobData);
}

/**
 * Internal method called by 'Agenda.stop()' to unlock jobs so that they can be re-run
 * NOTE: May need to update what properties get set here, since job unlocking seems to fail
 * @param {Function} done callback when jobs are unlocked
 * @access private
 * @returns {undefined}
 */
Agenda.prototype._unlockJobs = function(done) {
  var jobIds = this._lockedJobs.map(function(job) {
    return job.attrs._id;
  });
  this._collection.updateMany({_id: { $in: jobIds } }, { $set: { lockedAt: null } }, done);    // NF refactored .update() 22/04/2015
};

/**
 * Process methods for jobs
 * @param {module.Job} extraJob job to run immediately
 * @returns {undefined}
 */
function processJobs(extraJob) {

  // Make sure an interval has actually been set
  // Prevents race condition with 'Agenda.stop' and already scheduled run
  if (!this._processInterval) {
    return;
  }

  var definitions = this._definitions, jobName, jobQueue = this._jobQueue, self = this;

  // Determine whether or not we have a direct process call!
  if (!extraJob) {

    // Go through each jobName set in 'Agenda.process' and fill the queue with the next jobs
    for (jobName in definitions) {
      if ({}.hasOwnProperty.call(definitions, jobName)) {
        jobQueueFilling(jobName);
      }
    }

  } else if (definitions[extraJob.attrs.name]) {

    // Add the job to list of jobs to lock and then lock it immediately!
    self._jobsToLock.push(extraJob);
    lockOnTheFly();

  }

  /**
   * Returns true if a job of the specified name can be locked.
   * Considers maximum locked jobs at any time if self._lockLimit is > 0
   * Considers maximum locked jobs of the specified name at any time if jobDefinition.lockLimit is > 0
   * @param {String} name name of job to check if we should lock or not
   * @returns {boolean} Whether or not you should lock job
   */
  function shouldLock(name) {
    var shouldLock = true;
    var jobDefinition = definitions[name];
    if (self._lockLimit && self._lockLimit <= self._lockedJobs.length) {
      shouldLock = false;
    }
    if (jobDefinition.lockLimit && jobDefinition.lockLimit <= jobDefinition.locked) {
      shouldLock = false;
    }
    return shouldLock;
  }

  /**
   * Internal method that adds jobs to be processed to the local queue
   * @param {*} jobs Jobs to queue
   * @param {Boolean} inFront Skip the line!
   * @returns {undefined}
   */
  function enqueueJobs(jobs, inFront) {
    if (!Array.isArray(jobs)) {
      jobs = [jobs];
    }

    jobs.forEach(function(job) {
      var jobIndex, start, loopCondition, endCondition, inc;

      if (inFront) {
        start = jobQueue.length ? jobQueue.length - 1 : 0;
        inc = -1;
        loopCondition = function() {
          return jobIndex >= 0;
        };
        endCondition = function(queuedJob) {
          return !queuedJob || queuedJob.attrs.priority < job.attrs.priority;
        };
      } else {
        start = 0;
        inc = 1;
        loopCondition = function() {
          return jobIndex < jobQueue.length;
        };
        endCondition = function(queuedJob) {
          return queuedJob.attrs.priority >= job.attrs.priority;
        };
      }

      for (jobIndex = start; loopCondition(); jobIndex += inc) {
        if (endCondition(jobQueue[jobIndex])) break;
      }

      // Insert the job to the queue at its prioritized position for processing
      jobQueue.splice(jobIndex, 0, job);

    });
  }

  /**
   * Internal method that will lock a job and store it on Mongo
   * This method is called when we immediately start to process a job without using the process interval
   * We do this because sometimes jobs are scheduled but will be run before the next process time
   * @returns {undefined}
   */
  function lockOnTheFly() {

    // Already running this? Return
    if (self._isLockingOnTheFly) {
      return;
    }

    // Don't have any jobs to run? Return
    if (!self._jobsToLock.length) {
      self._isLockingOnTheFly = false;
      return;
    }

    // Set that we are running this
    self._isLockingOnTheFly = true;

    // Grab a job that needs to be locked
    var now = new Date();
    var job = self._jobsToLock.pop();

    // If locking limits have been hit, stop locking on the fly.
    // Jobs that were waiting to be locked will be picked up during a
    // future locking interval.
    if (!shouldLock(job.attrs.name)) {
      self._jobsToLock = [];
      self._isLockingOnTheFly = false;
      return;
    }

    // Query to run against collection to see if we need to lock it
    var criteria = {
      _id: job.attrs._id,
      lockedAt: null,
      nextRunAt: job.attrs.nextRunAt,
      disabled: { $ne: true }
    };

    // Update / options for the Mongo query
    var update = { $set: { lockedAt: now } };
    var options = { returnOriginal: false };

    // Lock the job in Mongo!
    self._collection.findOneAndUpdate(criteria, update, options, function(err, resp) {

      // Did the "job" get locked? Create a job object and run
      if (resp.value) {
        var job = createJob(self, resp.value);
        self._lockedJobs.push(job);
        definitions[job.attrs.name].locked++;
        enqueueJobs(job);
        jobProcessing();
      }

      // Mark lock on fly is done for now
      self._isLockingOnTheFly = false;

      // Re-run in case anything is in the queue
      lockOnTheFly();

    });
  }

  /**
   * Internal method used to fill a queue with jobs that can be run
   * @param {String} name fill a queue with specific job name
   * @returns {undefined}
   */
  function jobQueueFilling(name) {

    // Don't lock because of a limit we have set (lockLimit, etc)
    if (!shouldLock(name)) {
      return;
    }

    // Set the date of the next time we are going to run _processEvery function
    var now = new Date();
    self._nextScanAt = new Date(now.valueOf() + self._processEvery);

    // For this job name, find the next job to run and lock it!
    self._findAndLockNextJob(name, definitions[name], function(err, job) {

      if (err) {
        throw err;
      }

      // Still have the job?
      // 1. Add it to lock list
      // 2. Add count of locked jobs
      // 3. Queue the job to actually be run now that it is locked
      // 4. Recursively run this same method we are in to check for more available jobs of same type!
      if (job) {
        self._lockedJobs.push(job);
        definitions[job.attrs.name].locked++;
        enqueueJobs(job);
        jobQueueFilling(name);
        jobProcessing();
      }

    });
  }

  /**
   * Internal method that processes any jobs in the local queue (array)
   * @returns {undefined}
   */
  function jobProcessing() {

    // Ensure we have jobs
    if (!jobQueue.length) {
      return;
    }

    // Store for all sorts of things
    var now = new Date();

    // Get the next job that is not blocked by concurrency
    var next;
    for (next = jobQueue.length - 1; next > 0; next -= 1) {
      var def = definitions[jobQueue[next].attrs.name];
      if (def.concurrency > def.running) break;
    }

    // We now have the job we are going to process and its definition
    var job = jobQueue.splice(next, 1)[0], jobDefinition = definitions[job.attrs.name];

    // If the 'nextRunAt' time is older than the current time, run the job
    // Otherwise, setTimeout that gets called at the time of 'nextRunAt'
    if (job.attrs.nextRunAt < now) {
      runOrRetry();
    } else {
      setTimeout(runOrRetry, job.attrs.nextRunAt - now);
    }

    /**
     * Internal method that tries to run a job and if it fails, retries again!
     * @returns {undefined}
     */
    function runOrRetry() {
      if (self._processInterval) {
        if (jobDefinition.concurrency > jobDefinition.running &&
          self._runningJobs.length < self._maxConcurrency) {

          // Get the deadline of when the job is not supposed to go past for locking
          var lockDeadline = new Date(Date.now() - jobDefinition.lockLifetime);

          // This means a job has "expired", as in it has not been "touched" within the lockoutTime
          // Remove from local lock
          // NOTE: Shouldn't we update the 'lockedAt' value in Mongo so it can be picked up on restart?
          if (job.attrs.lockedAt < lockDeadline) {
            self._lockedJobs.splice(self._lockedJobs.indexOf(job), 1);
            jobDefinition.locked--;
            jobProcessing();
            return;
          }

          // Add to local "running" queue
          self._runningJobs.push(job);
          jobDefinition.running++;

          // CALL THE ACTUAL METHOD TO PROCESS THE JOB!!!
          job.run(processJobResult);

          // Re-run the loop to check for more jobs to process (locally)
          jobProcessing();

        } else {

          // Run the job immediately by putting it on the top of the queue
          enqueueJobs(job, true);

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

    if (err && !job) throw (err);
    var name = job.attrs.name;

    // Job isn't in running jobs so throw an error
    if (self._runningJobs.indexOf(job) === -1) throw ("callback already called - job " + name + " already marked complete");

    // Remove the job from the running queue
    self._runningJobs.splice(self._runningJobs.indexOf(job), 1);
    if (definitions[name].running > 0) definitions[name].running--;

    // Remove the job from the locked queue
    self._lockedJobs.splice(self._lockedJobs.indexOf(job), 1);
    if (definitions[name].locked > 0) definitions[name].locked--;

    // Re-process jobs now that one has finished
    jobProcessing();

  }
}
