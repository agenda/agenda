'use strict';
/**
 * General Notes:
 * - Refactor remaining deprecated MongoDB Native Driver methods: findAndModify()
 */

const Emitter = require('events').EventEmitter;
const humanInterval = require('human-interval');

class Agenda extends Emitter {
  constructor(config, cb) {
    super();

    if (!(this instanceof Agenda)) {
      return new Agenda(config);
    }

    config = config || {};

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
