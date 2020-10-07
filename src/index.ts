const {EventEmitter} = require('events');
const humanInterval = require('human-interval');
const JobProcessingQueue = require('./job-processing-queue');

/**
 * @class Agenda
 * @param {Object} config - Agenda Config
 * @param {Function} cb - Callback after Agenda has started and connected to mongo
 * @property {Object} _name - Name of the current Agenda queue
 * @property {Number} _processEvery
 * @property {Number} _defaultConcurrency
 * @property {Number} _maxConcurrency
 * @property {Number} _defaultLockLimit
 * @property {Number} _lockLimit
 * @property {Object} _definitions
 * @property {Object} _runningJobs
 * @property {Object} _lockedJobs
 * @property {Object} _jobQueue
 * @property {Number} _defaultLockLifetime
 * @property {Object} _sort
 * @property {Object} _indices
 * @property {Boolean} _isLockingOnTheFly
 * @property {Array} _jobsToLock
 */
class Agenda extends EventEmitter {
  // eslint-disable-next-line default-param-last
  constructor(config = {}, cb) {
    super();

    if (!(this instanceof Agenda)) {
      return new Agenda(config);
    }

    this._name = config.name;
    this._processEvery = humanInterval(config.processEvery) || humanInterval('5 seconds');
    this._defaultConcurrency = config.defaultConcurrency || 5;
    this._maxConcurrency = config.maxConcurrency || 20;
    this._defaultLockLimit = config.defaultLockLimit || 0;
    this._lockLimit = config.lockLimit || 0;
    this._definitions = {};
    this._runningJobs = [];
    this._lockedJobs = [];
    this._jobQueue = new JobProcessingQueue();
    this._defaultLockLifetime = config.defaultLockLifetime || 10 * 60 * 1000; // 10 minute default lockLifetime
    this._sort = config.sort || {nextRunAt: 1, priority: -1};
    this._indices = {name: 1, ...this._sort, priority: -1, lockedAt: 1, nextRunAt: 1, disabled: 1};

    this._isLockingOnTheFly = false;
    this._jobsToLock = [];
    this._ready = new Promise(resolve => this.once('ready', resolve));

    if (config.mongo) {
      this.mongo(config.mongo, config.db ? config.db.collection : undefined, cb);
      if (config.mongo.s && config.mongo.topology && config.mongo.topology.s) {
        this._mongoUseUnifiedTopology = Boolean(config.mongo.topology.s.options.useUnifiedTopology);
      }
    } else if (config.db) {
      this.database(config.db.address, config.db.collection, config.db.options, cb);
    }
  }
}

Agenda.prototype.mongo = require('./mongo');
Agenda.prototype.database = require('./database');
Agenda.prototype.db_init = require('./db-init'); // eslint-disable-line camelcase
Agenda.prototype.name = require('./name');
Agenda.prototype.processEvery = require('./process-every');
Agenda.prototype.maxConcurrency = require('./max-concurrency');
Agenda.prototype.defaultConcurrency = require('./default-concurrency');
Agenda.prototype.lockLimit = require('./locklimit');
Agenda.prototype.defaultLockLimit = require('./default-lock-limit');
Agenda.prototype.defaultLockLifetime = require('./default-lock-lifetime');
Agenda.prototype.sort = require('./sort');
Agenda.prototype.create = require('./create');
Agenda.prototype.jobs = require('./jobs');
Agenda.prototype.purge = require('./purge');
Agenda.prototype.define = require('./define');
Agenda.prototype.every = require('./every');
Agenda.prototype.schedule = require('./schedule');
Agenda.prototype.now = require('./now');
Agenda.prototype.cancel = require('./cancel');
Agenda.prototype.saveJob = require('./save-job');
Agenda.prototype.start = require('./start');
Agenda.prototype.stop = require('./stop');
Agenda.prototype._findAndLockNextJob = require('./find-and-lock-next-job');

module.exports = Agenda;
