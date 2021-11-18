"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Agenda = void 0;
const events_1 = require("events");
const human_interval_1 = __importDefault(require("human-interval"));
const cancel_1 = require("./cancel");
const close_1 = require("./close");
const create_1 = require("./create");
const database_1 = require("./database");
const db_init_1 = require("./db-init");
const default_concurrency_1 = require("./default-concurrency");
const default_lock_lifetime_1 = require("./default-lock-lifetime");
const default_lock_limit_1 = require("./default-lock-limit");
const define_1 = require("./define");
const disable_1 = require("./disable");
const enable_1 = require("./enable");
const every_1 = require("./every");
const find_and_lock_next_job_1 = require("./find-and-lock-next-job");
const job_processing_queue_1 = require("./job-processing-queue");
const jobs_1 = require("./jobs");
const lock_limit_1 = require("./lock-limit");
const max_concurrency_1 = require("./max-concurrency");
const mongo_1 = require("./mongo");
const name_1 = require("./name");
const now_1 = require("./now");
const process_every_1 = require("./process-every");
const purge_1 = require("./purge");
const save_job_1 = require("./save-job");
const schedule_1 = require("./schedule");
const sort_1 = require("./sort");
const start_1 = require("./start");
const stop_1 = require("./stop");
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
 * @property {Boolean} _isLockingOnTheFly - true if 'lockingOnTheFly' is currently running. Prevent concurrent execution of this method.
 * @property {Map} _isJobQueueFilling - A map of jobQueues and if the 'jobQueueFilling' method is currently running for a given map. 'lockingOnTheFly' and 'jobQueueFilling' should not run concurrently for the same jobQueue. It can cause that lock limits aren't honored.
 * @property {Array} _jobsToLock
 */
class Agenda extends events_1.EventEmitter {
    /**
     * Constructs a new Agenda object.
     * @param config Optional configuration to initialize the Agenda.
     * @param cb Optional callback called with the MongoDB collection.
     */
    constructor(config = {}, cb) {
        var _a;
        super();
        this._findAndLockNextJob = find_and_lock_next_job_1.findAndLockNextJob;
        this._name = config.name;
        this._processEvery = ((_a = human_interval_1.default(config.processEvery)) !== null && _a !== void 0 ? _a : human_interval_1.default("5 seconds")); // eslint-disable-line @typescript-eslint/non-nullable-type-assertion-style
        this._defaultConcurrency = config.defaultConcurrency || 5;
        this._maxConcurrency = config.maxConcurrency || 20;
        this._defaultLockLimit = config.defaultLockLimit || 0;
        this._lockLimit = config.lockLimit || 0;
        this._definitions = {};
        this._runningJobs = [];
        this._lockedJobs = [];
        this._jobQueue = new job_processing_queue_1.JobProcessingQueue();
        this._defaultLockLifetime = config.defaultLockLifetime || 10 * 60 * 1000; // 10 minute default lockLifetime
        this._sort = config.sort || { nextRunAt: 1, priority: -1 };
        this._indices = Object.assign(Object.assign({ name: 1 }, this._sort), { priority: -1, lockedAt: 1, nextRunAt: 1, disabled: 1 });
        this._isLockingOnTheFly = false;
        this._isJobQueueFilling = new Map();
        this._jobsToLock = [];
        this._ready = new Promise((resolve) => {
            this.once("ready", resolve);
        });
        if (config.mongo) {
            this.mongo(config.mongo, config.db ? config.db.collection : undefined, cb); // @ts-expect-error // the documentation shows it should be correct: http://mongodb.github.io/node-mongodb-native/3.6/api/Db.html
            if (config.mongo.s && config.mongo.topology && config.mongo.topology.s) {
                this._mongoUseUnifiedTopology = Boolean(
                // @ts-expect-error
                config.mongo.topology.s.options.useUnifiedTopology);
            }
        }
        else if (config.db) {
            this.database(config.db.address, config.db.collection, config.db.options, cb);
        }
    }
}
exports.Agenda = Agenda;
Agenda.prototype.cancel = cancel_1.cancel;
Agenda.prototype.close = close_1.close;
Agenda.prototype.create = create_1.create;
Agenda.prototype.database = database_1.database;
Agenda.prototype.db_init = db_init_1.dbInit;
Agenda.prototype.defaultConcurrency = default_concurrency_1.defaultConcurrency;
Agenda.prototype.defaultLockLifetime = default_lock_lifetime_1.defaultLockLifetime;
Agenda.prototype.defaultLockLimit = default_lock_limit_1.defaultLockLimit;
Agenda.prototype.define = define_1.define;
Agenda.prototype.disable = disable_1.disable;
Agenda.prototype.enable = enable_1.enable;
Agenda.prototype.every = every_1.every;
Agenda.prototype.jobs = jobs_1.jobs;
Agenda.prototype.lockLimit = lock_limit_1.lockLimit;
Agenda.prototype.maxConcurrency = max_concurrency_1.maxConcurrency;
Agenda.prototype.mongo = mongo_1.mongo;
Agenda.prototype.name = name_1.name;
Agenda.prototype.now = now_1.now;
Agenda.prototype.processEvery = process_every_1.processEvery;
Agenda.prototype.purge = purge_1.purge;
Agenda.prototype.saveJob = save_job_1.saveJob;
Agenda.prototype.schedule = schedule_1.schedule;
Agenda.prototype.sort = sort_1.sort;
Agenda.prototype.start = start_1.start;
Agenda.prototype.stop = stop_1.stop;
//# sourceMappingURL=index.js.map