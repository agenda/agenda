'use strict';
/**
 * General Notes:
 * - Refactor remaining deprecated MongoDB Native Driver methods: findAndModify()
 */

/**
 * Debug Notes:
 * Use debug('some text') to print debugging information
 * It uses printf style formatting and supports the following:
 * %O  Pretty-print an Object on multiple lines.
 * %o  Pretty-print an Object all on a single line.
 * %s  String.
 * %d  Number (both integer and float).
 * %j  JSON. Replaced with the string '[Circular]' if the argument contains circular references.
 * %%  Single percent sign ('%'). This does not consume an argument.
 * Example: debug('job started with attrs: %j', job.toJSON())
 * To view output, run using command "DEBUG=agenda:* node index.js"
 */

const utils = require('util');
const Emitter = require('events').EventEmitter;
const humanInterval = require('human-interval');
const debug = require('debug')('agenda:worker');
const MongoClient = require('mongodb').MongoClient;
const Job = require('./job');

const Agenda = function(config, cb) {
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
  this._sort = config.sort || {nextRunAt: 1, priority: -1};
  this._indices = Object.assign({name: 1}, this._sort, {priority: -1, lockedAt: 1, nextRunAt: 1, disabled: 1});

  this._isLockingOnTheFly = false;
  this._jobsToLock = [];
  if (config.mongo) {
    this.mongo(config.mongo, config.db ? config.db.collection : undefined, cb);
  } else if (config.db) {
    this.database(config.db.address, config.db.collection, config.db.options, cb);
  }
};

// Jobs use emit() to fire job events clients can use
utils.inherits(Agenda, Emitter);

/**
 * Build method used to add MongoDB connection details
 * @param {MongoClient} mdb instance of MongoClient to use
 * @param {String} collection name collection we want to use ('agendaJobs')
 * @param {Function} cb called when MongoDB connection fails or passes
 * @returns {exports} instance of Agenda
 */
Agenda.prototype.mongo = function(mdb, collection, cb) {
  this._mdb = mdb;
  this.db_init(collection, cb);
  return this;
};

/**
 * Connect to the spec'd MongoDB server and database.
 * @param {String} url MongoDB server URI
 * @param {String} collection name of collection to use
 * @param {Object} options options for connecting
 * @param {Function} cb callback of MongoDB connection
 * @returns {exports}
 * NOTE:
 * If `url` includes auth details then `options` must specify: { 'uri_decode_auth': true }. This does Auth on
 * the specified database, not the Admin database. If you are using Auth on the Admin DB and not on the Agenda DB,
 * then you need to authenticate against the Admin DB and then pass the MongoDB instance into the constructor
 * or use Agenda.mongo(). If your app already has a MongoDB connection then use that. ie. specify config.mongo in
 * the constructor or use Agenda.mongo().
 */
Agenda.prototype.database = function(url, collection, options, cb) {
  const self = this;
  if (!url.match(/^mongodb:\/\/.*/)) {
    url = 'mongodb://' + url;
  }

  collection = collection || 'agendaJobs';
  options = Object.assign({autoReconnect: true, reconnectTries: Number.MAX_SAFE_INTEGER, reconnectInterval: this._processEvery}, options);
  MongoClient.connect(url, options, (error, db) => {
    if (error) {
      debug('error connecting to MongoDB using collection: [%s]', collection);
      if (cb) {
        cb(error, null);
      } else {
        throw error;
      }
      return;
    }
    debug('successful connection to MongoDB using collection: [%s]', collection);
    self._mdb = db;
    self.db_init(collection, cb);
  });
  return this;
};

/**
 * Setup and initialize the collection used to manage Jobs.
 * @param {String} collection name or undefined for default 'agendaJobs'
 * @param {Function} cb called when the db is initialized
 * @returns {undefined}
 */
Agenda.prototype.db_init = function(collection, cb) { // eslint-disable-line camelcase
  const self = this;
  debug('init database collection using name [%s]', collection);
  this._collection = this._mdb.collection(collection || 'agendaJobs');
  debug('attempting index creation');
  this._collection.createIndex(this._indices, {
    name: 'findAndLockNextJobIndex'
  }, (err, result) => {
    if (err) {
      debug('index creation failed, attempting legacy index creation next');
    } else {
      debug('index creation success');
    }
    handleLegacyCreateIndex(err, result, self, cb);
  });
};

/**
 * Internal method called in the case where new indices have an error during creation
 * @param {Error} err error returned from index creation from before
 * @param {*} result result passed in from earlier attempt of creating index
 * @param {Agenda} self instance of Agenda
 * @param {Function} cb called when indices fail or pass
 * @returns {undefined}
 */
function handleLegacyCreateIndex(err, result, self, cb) {
  if (err && err.message !== 'no such cmd: createIndex') {
    debug('not attempting legacy index, emitting error');
    self.emit('error', err);
  } else {
    // Looks like a mongo.version < 2.4.x
    err = null;
    self._collection.ensureIndex(self._indices, {
      name: 'findAndLockNextJobIndex'
    });
    self.emit('ready');
  }
  if (cb) {
    cb(err, self._collection);
  }
}

/**
 * Set name of queue
 * @param {String} name name of agenda instance
 * @returns {exports} agenda instance
 */
Agenda.prototype.name = function(name) {
  debug('Agenda.name(%s)', name);
  this._name = name;
  return this;
};

/**
 * Set the default process interval
 * @param {Number} time time to process
 * @returns {exports} agenda instance
 */
Agenda.prototype.processEvery = function(time) {
  debug('Agenda.processEvery(%d)', time);
  this._processEvery = humanInterval(time);
  return this;
};

/**
 * Set the concurrency for jobs (globally), type does not matter
 * @param {Number} num max concurrency value
 * @returns {exports} agenda instance
 */
Agenda.prototype.maxConcurrency = function(num) {
  debug('Agenda.maxConcurrency(%d)', num);
  this._maxConcurrency = num;
  return this;
};

/**
 * Set the default concurrency for each job
 * @param {Number} num default concurrency
 * @returns {exports} agenda instance
 */
Agenda.prototype.defaultConcurrency = function(num) {
  debug('Agenda.defaultConcurrency(%d)', num);
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
  debug('Agenda.lockLimit(%d)', num);
  this._lockLimit = num;
  return this;
};

/**
 * Set default lock limit per job type
 * @param {Number} num Lock limit per job
 * @returns {exports} agenda instance
 */
Agenda.prototype.defaultLockLimit = function(num) {
  debug('Agenda.defaultLockLimit(%d)', num);
  this._defaultLockLimit = num;
  return this;
};

/**
 * Set the default lock time (in ms)
 * Default is 10 * 60 * 1000 ms (10 minutes)
 * @param {Number} ms time in ms to set default lock
 * @returns {exports} agenda instance
 */
Agenda.prototype.defaultLockLifetime = function(ms) {
  debug('Agenda.defaultLockLifetime(%d)', ms);
  this._defaultLockLifetime = ms;
  return this;
};

/**
 * Set the sort query for finding next job
 * Default is { nextRunAt: 1, priority: -1 }
 * @param {Object} query sort query object for MongoDB
 * @returns {exports} agenda instance
 */
Agenda.prototype.sort = function(query) {
  debug('Agenda.sort([Object])');
  this._sort = query;
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
  debug('Agenda.create(%s, [Object])', name);
  const priority = this._definitions[name] ? this._definitions[name].priority : 0;
  const job = new Job({name, data, type: 'normal', priority, agenda: this});
  return job;
};

/**
 * Finds all jobs matching 'query'
 * @param {Object} query object for MongoDB
 * @param {Function} cb called when fails or passes
 * @returns {undefined}
 */
Agenda.prototype.jobs = function(query, cb) {
  const self = this;
  this._collection.find(query).toArray((error, result) => {
    let jobs;
    if (!error) {
      jobs = result.map(createJob.bind(null, self));
    }
    cb(error, jobs);
  });
};

/**
 * Removes all jobs from queue
 * NOTE: Only use after defining your jobs
 * @param {Function} cb called when fails or passes
 * @returns {undefined}
 */
Agenda.prototype.purge = function(cb) {
  const definedNames = Object.keys(this._definitions);
  debug('Agenda.purge(%o)');
  this.cancel({name: {$not: {$in: definedNames}}}, cb);
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
  debug('job [%s] defined with following options: \n%O', name, this._definitions[name]);
};

/**
 * Creates a scheduled job with given interval and name/names of the job to run
 * @param {Number} interval run every X interval
 * @param {*} names String or strings of jobs to schedule
 * @param {Object} data data to run for job
 * @param {Object} options options to run job for
 * @param {Function} cb called when schedule fails or passes
 * @returns {*} Job or jobs created
 */
Agenda.prototype.every = function(interval, names, data, options, cb) {
  const self = this;

  if (cb === undefined && typeof data === 'function') {
    cb = data;
    data = undefined;
  } else if (cb === undefined && typeof options === 'function') {
    cb = options;
    options = undefined;
  }

  /**
   * Internal method to setup job that gets run every interval
   * @param {Number} interval run every X interval
   * @param {*} name String job to schedule
   * @param {Object} data data to run for job
   * @param {Object} options options to run job for
   * @param {Function} cb called when schedule fails or passes
   * @returns {module.Job} instance of job
   */
  const createJob = (interval, name, data, options, cb) => {
    const job = self.create(name, data);
    job.attrs.type = 'single';
    job.repeatEvery(interval, options);
    job.computeNextRunAt();
    job.save(cb);
    return job;
  };

  /**
   * Internal helper method that uses createJob to create jobs for an array of names
   * @param {Number} interval run every X interval
   * @param {*} names Strings of jobs to schedule
   * @param {Object} data data to run for job
   * @param {Object} options options to run job for
   * @param {Function} cb called when schedule fails or passes
   * @returns {*} array of jobs created
   */
  const createJobs = (interval, names, data, options, cb) => {
    const results = [];
    let pending = names.length;
    let errored = false;
    return names.map((name, i) => {
      return createJob(interval, name, data, options, (err, result) => {
        if (err) {
          if (!errored) {
            cb(err);
          }
          errored = true;
          return;
        }
        results[i] = result;
        if (--pending === 0 && cb) {
          debug('every() -> all jobs created successfully');
          cb(null, results);
        } else {
          debug('every() -> error creating one or more of the jobs');
        }
      });
    });
  };

  if (typeof names === 'string' || names instanceof String) {
    debug('Agenda.every(%s, %O, [Object], %O, cb)', interval, names, options);
    return createJob(interval, names, data, options, cb);
  } else if (Array.isArray(names)) {
    debug('Agenda.every(%s, %s, [Object], %O, cb)', interval, names, options);
    return createJobs(interval, names, data, options, cb);
  }
};

/**
 * Schedule a job or jobs at a specific time
 * @param {String} when when the job gets run
 * @param {*} names array of job names to run
 * @param {Object} data data to send to job
 * @param {Function} cb called when schedule fails or passes
 * @returns {*} job or jobs created
 */
Agenda.prototype.schedule = function(when, names, data, cb) {
  const self = this;

  if (cb === undefined && typeof data === 'function') {
    cb = data;
    data = undefined;
  }

  /**
   * Internal method that creates a job with given date
   * @param {String} when when the job gets run
   * @param {String} name of job to run
   * @param {Object} data data to send to job
   * @param {Function} cb called when job persistence in MongoDB fails or passes
   * @returns {module.Job} instance of new job
   */
  const createJob = (when, name, data, cb) => {
    const job = self.create(name, data);
    job.schedule(when);
    job.save(cb);
    return job;
  };

  /**
   * Internal helper method that calls createJob on a names array
   * @param {String} when when the job gets run
   * @param {*} names of jobs to run
   * @param {Object} data data to send to job
   * @param {Function} cb called when job(s) persistence in MongoDB fails or passes
   * @returns {*} jobs that were created
   */
  const createJobs = (when, names, data, cb) => {
    const results = [];
    let pending = names.length;
    let errored = false;
    return names.map((name, i) => {
      return createJob(when, name, data, (err, result) => {
        if (err) {
          if (!errored) {
            cb(err);
          }
          errored = true;
          return;
        }
        results[i] = result;
        if (--pending === 0 && cb) {
          debug('Agenda.schedule()::createJobs() -> all jobs created successfully');
          cb(null, results);
        } else {
          debug('Agenda.schedule()::createJobs() -> error creating one or more of the jobs');
        }
      });
    });
  };

  if (typeof names === 'string' || names instanceof String) {
    debug('Agenda.schedule(%s, %O, [Object], cb)', when, names);
    return createJob(when, names, data, cb);
  } else if (Array.isArray(names)) {
    debug('Agenda.schedule(%s, %O, [Object], cb)', when, names);
    return createJobs(when, names, data, cb);
  }
};

/**
 * Create a job for this exact moment
 * @param {String} name name of job to schedule
 * @param {Object} data data to pass to job
 * @param {Function} cb called when job scheduling fails or passes
 * @returns {module.Job} new job instance created
 */
Agenda.prototype.now = function(name, data, cb) {
  if (!cb && typeof data === 'function') {
    cb = data;
    data = undefined;
  }
  debug('Agenda.now(%s, [Object])', name);
  const job = this.create(name, data);
  job.schedule(new Date());
  job.save(cb);
  return job;
};

/**
 * Cancels any jobs matching the passed MongoDB query, and removes them from the database.
 *  @param {Object} query MongoDB query to use when cancelling
 *  @param {Function} cb callback(error, numRemoved) when cancellation fails or passes
 *  @caller client code, Agenda.purge(), Job.remove()
 *  @returns {undefined}
 */
Agenda.prototype.cancel = function(query, cb) {
  debug('attempting to cancel all Agenda jobs', query);
  this._collection.deleteMany(query, (error, result) => {
    if (cb) {
      if (error) {
        debug('error trying to delete jobs from MongoDB');
      } else {
        debug('jobs cancelled');
      }
      cb(error, result && result.result ? result.result.n : undefined);
    }
  });
};

/**
 * Save the properties on a job to MongoDB
 * @param {module.Job} job job to save into MongoDB
 * @param {Function} cb called when job is saved or errors
 * @returns {undefined}
 */
Agenda.prototype.saveJob = function(job, cb) {
  debug('attempting to save a job into Agenda instance');

  // Grab information needed to save job but that we don't want to persist in MongoDB
  const fn = cb;
  const self = this;
  const id = job.attrs._id;
  const unique = job.attrs.unique;
  const uniqueOpts = job.attrs.uniqueOpts;

  // Store job as JSON and remove props we don't want to store from object
  const props = job.toJSON();
  delete props._id;
  delete props.unique;
  delete props.uniqueOpts;

  // Store name of agenda queue as last modifier in job data
  props.lastModifiedBy = this._name;
  debug('set job props: \n%O', props);

  // Grab current time and set default query options for MongoDB
  const now = new Date();
  const protect = {};
  let update = {$set: props};
  debug('current time stored as %s', now.toISOString());

  // If the job already had an ID, then update the properties of the job
  // i.e, who last modified it, etc
  if (id) {
    // Update the job and process the resulting data'
    debug('job already has _id, calling findOneAndUpdate() using _id as query');
    this._collection.findOneAndUpdate({
      _id: id
    },
    update, {
      returnOriginal: false
    },
    processDbResult);
  } else if (props.type === 'single') {
    // Job type set to 'single' so...
    // NOTE: Again, not sure about difference between 'single' here and 'once' in job.js
    debug('job with type of "single" found');

    // If the nextRunAt time is older than the current time, "protect" that property, meaning, don't change
    // a scheduled job's next run time!
    if (props.nextRunAt && props.nextRunAt <= now) {
      debug('job has a scheduled nextRunAt time, protecting that field from upsert');
      protect.nextRunAt = props.nextRunAt;
      delete props.nextRunAt;
    }

    // If we have things to protect, set them in MongoDB using $setOnInsert
    if (Object.keys(protect).length > 0) {
      update.$setOnInsert = protect;
    }

    // Try an upsert
    // NOTE: 'single' again, not exactly sure what it means
    debug('calling findOneAndUpdate() with job name and type of "single" as query');
    this._collection.findOneAndUpdate({
      name: props.name,
      type: 'single'
    },
    update, {
      upsert: true,
      returnOriginal: false
    },
    processDbResult);
  } else if (unique) {
    // If we want the job to be unique, then we can upsert based on the 'unique' query object that was passed in
    const query = job.attrs.unique;
    query.name = props.name;
    if (uniqueOpts && uniqueOpts.insertOnly) {
      update = {$setOnInsert: props};
    }

    // Use the 'unique' query object to find an existing job or create a new one
    debug('calling findOneAndUpdate() with unique object as query: \n%O', query);
    this._collection.findOneAndUpdate(query, update, {upsert: true, returnOriginal: false}, processDbResult);
  } else {
    // If all else fails, the job does not exist yet so we just insert it into MongoDB
    debug('using default behavior, inserting new job via insertOne() with props that were set: \n%O', props);
    this._collection.insertOne(props, processDbResult);
  }

  /**
   * Given a result for findOneAndUpdate() or insert() above, determine whether to process
   * the job immediately or to let the processJobs() interval pick it up later
   * @param {Error} err error passed in via MongoDB call as to whether modify call failed or passed
   * @param {*} result the data returned from the findOneAndUpdate() call or insertOne() call
   * @access private
   * @returns {undefined}
   */
  function processDbResult(err, result) {
    // Check if there is an error and either cb(error) or throw if there is no callback
    if (err) {
      debug('processDbResult() received an error, job was not updated/created');
      if (fn) {
        return fn(err);
      }
      throw err;
    } else if (result) {
      debug('processDbResult() called with success, checking whether to process job immediately or not');

      // We have a result from the above calls
      // findAndModify() returns different results than insertOne() so check for that
      let res = result.ops ? result.ops : result.value;
      if (res) {
        // If it is an array, grab the first job
        if (Array.isArray(res)) {
          res = res[0];
        }

        // Grab ID and nextRunAt from MongoDB and store it as an attribute on Job
        job.attrs._id = res._id;
        job.attrs.nextRunAt = res.nextRunAt;

        // If the current job would have been processed in an older scan, process the job immediately
        if (job.attrs.nextRunAt && job.attrs.nextRunAt < self._nextScanAt) {
          debug('[%s:%s] job would have ran by nextScanAt, processing the job immediately', job.attrs.name, res._id);
          processJobs.call(self, job);
        }
      }
    }

    // If we have a callback, return the Job instance
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
  if (this._processInterval) {
    debug('Agenda.start was already called, ignoring');
  } else {
    debug('Agenda.start called, creating interval to call processJobs every [%dms]', this._processEvery);
    this._processInterval = setInterval(processJobs.bind(this), this._processEvery);
    process.nextTick(processJobs.bind(this));
  }
};

/**
 * Clear the interval that processes the jobs
 * @param {Function} cb called when job unlocking fails or passes
 * @returns {undefined}
 */
Agenda.prototype.stop = function(cb) {
  debug('Agenda.stop called, clearing interval for processJobs()');
  cb = cb || function() {};
  clearInterval(this._processInterval);
  this._processInterval = undefined;
  this._unlockJobs(cb);
};

/**
 * Find and lock jobs
 * @param {String} jobName name of job to try to lock
 * @param {Object} definition definition used to tell how job is run
 * @param {Function} cb called when job lock fails or passes
 * @access protected
 * @caller jobQueueFilling() only
 * @returns {undefined}
 */
Agenda.prototype._findAndLockNextJob = function(jobName, definition, cb) {
  const self = this;
  const now = new Date();
  const lockDeadline = new Date(Date.now().valueOf() - definition.lockLifetime);
  debug('_findAndLockNextJob(%s, [Function], cb)', jobName);

  // Don't try and access MongoDB if we've lost connection to it.
  // Trying to resolve crash on Dev PC when it resumes from sleep. NOTE: Does this still happen?
  const s = this._mdb.s || this._mdb.db.s;
  if (s.topology.connections().length === 0) {
    if (s.topology.autoReconnect && !s.topology.isDestroyed()) {
      // Continue processing but notify that Agenda has lost the connection
      debug('Missing MongoDB connection, not attempting to find and lock a job');
      self.emit('error', new Error('Lost MongoDB connection'));
      cb();
    } else {
      // No longer recoverable
      debug('topology.autoReconnect: %s, topology.isDestroyed(): %s', s.topology.autoReconnect, s.topology.isDestroyed());
      cb(new Error('MongoDB connection is not recoverable, application restart required'));
    }
  } else {
    /**
    * Query used to find job to run
    * @type {{$or: [*]}}
    */
    const JOB_PROCESS_WHERE_QUERY = {
      $or: [{
        name: jobName,
        lockedAt: null,
        nextRunAt: {$lte: this._nextScanAt},
        disabled: {$ne: true}
      }, {
        name: jobName,
        lockedAt: {$exists: false},
        nextRunAt: {$lte: this._nextScanAt},
        disabled: {$ne: true}
      }, {
        name: jobName,
        lockedAt: {$lte: lockDeadline},
        disabled: {$ne: true}
      }]
    };

    /**
    * Query used to set a job as locked
    * @type {{$set: {lockedAt: Date}}}
    */
    const JOB_PROCESS_SET_QUERY = {$set: {lockedAt: now}};

    /**
    * Query used to affect what gets returned
    * @type {{returnOriginal: boolean, sort: object}}
    */
    const JOB_RETURN_QUERY = {returnOriginal: false, sort: this._sort};

    // Find ONE and ONLY ONE job and set the 'lockedAt' time so that job begins to be processed
    this._collection.findOneAndUpdate(JOB_PROCESS_WHERE_QUERY, JOB_PROCESS_SET_QUERY, JOB_RETURN_QUERY, (err, result) => {
      let job;
      if (!err && result.value) {
        debug('found a job available to lock, creating a new job on Agenda with id [%s]', result.value._id);
        job = createJob(self, result.value);
      }
      if (err) {
        debug('error occurred when running query to find and lock job');
      }
      cb(err, job);
    });
  }
};

/**
 * Create Job object from data
 * @param {Object} agenda instance of Agenda
 * @param {Object} jobData job data
 * @returns {module.Job} returns created job
 */
function createJob(agenda, jobData) {
  jobData.agenda = agenda;
  return new Job(jobData);
}

/**
 * Internal method called by 'Agenda.stop()' to unlock jobs so that they can be re-run
 * NOTE: May need to update what properties get set here, since job unlocking seems to fail
 * @param {Function} done callback called when job unlocking fails or passes
 * @access private
 * @returns {undefined}
 */
Agenda.prototype._unlockJobs = function(done) {
  debug('Agenda._unlockJobs()');
  const jobIds = this._lockedJobs.map(job => job.attrs._id);
  debug('about to unlock jobs with ids: %O', jobIds);
  this._collection.updateMany({_id: {$in: jobIds}}, {$set: {lockedAt: null}}, done);
};

/**
 * Process methods for jobs
 * @param {module.Job} extraJob job to run immediately
 * @returns {undefined}
 */
function processJobs(extraJob) {
  debug('starting to process jobs');
  // Make sure an interval has actually been set
  // Prevents race condition with 'Agenda.stop' and already scheduled run
  if (!this._processInterval) {
    debug('no _processInterval set when calling processJobs, returning');
    return;
  }

  const self = this;
  const definitions = this._definitions;
  const jobQueue = this._jobQueue;
  let jobName;

  // Determine whether or not we have a direct process call!
  if (!extraJob) {
    // Go through each jobName set in 'Agenda.process' and fill the queue with the next jobs
    for (jobName in definitions) {
      if ({}.hasOwnProperty.call(definitions, jobName)) {
        debug('queuing up job to process: [%s]', jobName);
        jobQueueFilling(jobName);
      }
    }
  } else if (definitions[extraJob.attrs.name]) {
    // Add the job to list of jobs to lock and then lock it immediately!
    debug('job [%s] was passed directly to processJobs(), locking and running immediately', extraJob.attrs.name);
    self._jobsToLock.push(extraJob);
    lockOnTheFly();
  }

  /**
   * Returns true if a job of the specified name can be locked.
   * Considers maximum locked jobs at any time if self._lockLimit is > 0
   * Considers maximum locked jobs of the specified name at any time if jobDefinition.lockLimit is > 0
   * @param {String} name name of job to check if we should lock or not
   * @returns {boolean} whether or not you should lock job
   */
  function shouldLock(name) {
    const jobDefinition = definitions[name];
    let shouldLock = true;
    if (self._lockLimit && self._lockLimit <= self._lockedJobs.length) {
      shouldLock = false;
    }
    if (jobDefinition.lockLimit && jobDefinition.lockLimit <= jobDefinition.locked) {
      shouldLock = false;
    }
    debug('job [%s] lock status: shouldLock = %s', name, shouldLock);
    return shouldLock;
  }

  /**
   * Internal method that adds jobs to be processed to the local queue
   * @param {*} jobs Jobs to queue
   * @param {boolean} inFront puts the job in front of queue if true
   * @returns {undefined}
   */
  function enqueueJobs(jobs, inFront) {
    if (!Array.isArray(jobs)) {
      jobs = [jobs];
    }

    jobs.forEach(job => {
      let jobIndex;
      let start;
      let loopCondition;
      let endCondition;
      let inc;

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
        if (endCondition(jobQueue[jobIndex])) {
          break;
        }
      }

      // Insert the job to the queue at its prioritized position for processing
      jobQueue.splice(jobIndex, 0, job);
    });
  }

  /**
   * Internal method that will lock a job and store it on MongoDB
   * This method is called when we immediately start to process a job without using the process interval
   * We do this because sometimes jobs are scheduled but will be run before the next process time
   * @returns {undefined}
   */
  function lockOnTheFly() {
    // Already running this? Return
    if (self._isLockingOnTheFly) {
      debug('lockOnTheFly() already running, returning');
      return;
    }

    // Don't have any jobs to run? Return
    if (self._jobsToLock.length === 0) {
      debug('no jobs to current lock on the fly, returning');
      self._isLockingOnTheFly = false;
      return;
    }

    // Set that we are running this
    self._isLockingOnTheFly = true;

    // Grab a job that needs to be locked
    const now = new Date();
    const job = self._jobsToLock.pop();

    // If locking limits have been hit, stop locking on the fly.
    // Jobs that were waiting to be locked will be picked up during a
    // future locking interval.
    if (!shouldLock(job.attrs.name)) {
      debug('lock limit hit for: [%s]', job.attrs.name);
      self._jobsToLock = [];
      self._isLockingOnTheFly = false;
      return;
    }

    // Query to run against collection to see if we need to lock it
    const criteria = {
      _id: job.attrs._id,
      lockedAt: null,
      nextRunAt: job.attrs.nextRunAt,
      disabled: {$ne: true}
    };

    // Update / options for the MongoDB query
    const update = {$set: {lockedAt: now}};
    const options = {returnOriginal: false};

    // Lock the job in MongoDB!
    self._collection.findOneAndUpdate(criteria, update, options, (err, resp) => {
      if (err) {
        throw err;
      }
      // Did the "job" get locked? Create a job object and run
      if (resp.value) {
        const job = createJob(self, resp.value);
        debug('found job [%s] that can be locked on the fly', job.attrs.name);
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
      debug('lock limit reached in queue filling for [%s]', name);
      return;
    }

    // Set the date of the next time we are going to run _processEvery function
    const now = new Date();
    self._nextScanAt = new Date(now.valueOf() + self._processEvery);

    // For this job name, find the next job to run and lock it!
    self._findAndLockNextJob(name, definitions[name], (err, job) => {
      if (err) {
        debug('[%s] job lock failed while filling queue', name);
        throw err;
      }

      // Still have the job?
      // 1. Add it to lock list
      // 2. Add count of locked jobs
      // 3. Queue the job to actually be run now that it is locked
      // 4. Recursively run this same method we are in to check for more available jobs of same type!
      if (job) {
        debug('[%s:%s] job locked while filling queue', name, job.attrs._id);
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
    if (jobQueue.length === 0) {
      return;
    }

    // Store for all sorts of things
    const now = new Date();

    // Get the next job that is not blocked by concurrency
    let next;
    for (next = jobQueue.length - 1; next > 0; next -= 1) {
      const def = definitions[jobQueue[next].attrs.name];
      if (def.concurrency > def.running) {
        break;
      }
    }

    // We now have the job we are going to process and its definition
    const job = jobQueue.splice(next, 1)[0];
    const jobDefinition = definitions[job.attrs.name];

    debug('[%s:%s] about to process job', job.attrs.name, job.attrs._id);

    // If the 'nextRunAt' time is older than the current time, run the job
    // Otherwise, setTimeout that gets called at the time of 'nextRunAt'
    if (job.attrs.nextRunAt < now) {
      debug('[%s:%s] nextRunAt is in the past, run the job immediately', job.attrs.name, job.attrs._id);
      runOrRetry();
    } else {
      const runIn = job.attrs.nextRunAt - now;
      debug('[%s:%s] nextRunAt is in the future, calling setTimeout(%d)', job.attrs.name, job.attrs._id, runIn);
      setTimeout(runOrRetry, runIn);
    }

    /**
     * Internal method that tries to run a job and if it fails, retries again!
     * @returns {undefined}
     */
    function runOrRetry() {
      if (self._processInterval) {
        if (jobDefinition.concurrency > jobDefinition.running && self._runningJobs.length < self._maxConcurrency) {
          // Get the deadline of when the job is not supposed to go past for locking
          const lockDeadline = new Date(Date.now() - jobDefinition.lockLifetime);

          // This means a job has "expired", as in it has not been "touched" within the lockoutTime
          // Remove from local lock
          // NOTE: Shouldn't we update the 'lockedAt' value in MongoDB so it can be picked up on restart?
          if (job.attrs.lockedAt < lockDeadline) {
            debug('[%s:%s] job lock has expired, freeing it up', job.attrs.name, job.attrs._id);
            self._lockedJobs.splice(self._lockedJobs.indexOf(job), 1);
            jobDefinition.locked--;
            jobProcessing();
            return;
          }

          // Add to local "running" queue
          self._runningJobs.push(job);
          jobDefinition.running++;

          // CALL THE ACTUAL METHOD TO PROCESS THE JOB!!!
          debug('[%s:%s] processing job', job.attrs.name, job.attrs._id);
          job.run(processJobResult);

          // Re-run the loop to check for more jobs to process (locally)
          jobProcessing();
        } else {
          // Run the job immediately by putting it on the top of the queue
          debug('[%s:%s] concurrency preventing immediate run, pushing job to top of queue', job.attrs.name, job.attrs._id);
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
    if (err && !job) {
      throw (err);
    }
    const name = job.attrs.name;

    // Job isn't in running jobs so throw an error
    if (self._runningJobs.indexOf(job) === -1) {
      debug('[%s] callback was called, job must have been marked as complete already', job.attrs._id);
      throw new Error('callback already called - job ' + name + ' already marked complete');
    }

    // Remove the job from the running queue
    self._runningJobs.splice(self._runningJobs.indexOf(job), 1);
    if (definitions[name].running > 0) {
      definitions[name].running--;
    }

    // Remove the job from the locked queue
    self._lockedJobs.splice(self._lockedJobs.indexOf(job), 1);
    if (definitions[name].locked > 0) {
      definitions[name].locked--;
    }

    // Re-process jobs now that one has finished
    jobProcessing();
  }
}

module.exports = Agenda;
