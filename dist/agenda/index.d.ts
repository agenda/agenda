/// <reference types="node" />
import { EventEmitter } from "events";
import { AnyError, Collection, Db as MongoDb, MongoClient, MongoClientOptions } from "mongodb";
import { Job } from "../job";
import { cancel } from "./cancel";
import { close } from "./close";
import { create } from "./create";
import { database } from "./database";
import { dbInit } from "./db-init";
import { defaultConcurrency } from "./default-concurrency";
import { defaultLockLifetime } from "./default-lock-lifetime";
import { defaultLockLimit } from "./default-lock-limit";
import { define } from "./define";
import { disable } from "./disable";
import { enable } from "./enable";
import { every } from "./every";
import { JobProcessingQueue } from "./job-processing-queue";
import { jobs } from "./jobs";
import { lockLimit } from "./lock-limit";
import { maxConcurrency } from "./max-concurrency";
import { mongo } from "./mongo";
import { name } from "./name";
import { now } from "./now";
import { processEvery } from "./process-every";
import { purge } from "./purge";
import { saveJob } from "./save-job";
import { schedule } from "./schedule";
import { sort } from "./sort";
import { start } from "./start";
import { stop } from "./stop";
export interface AgendaConfig {
    name?: string;
    processEvery?: string;
    maxConcurrency?: number;
    defaultConcurrency?: number;
    lockLimit?: number;
    defaultLockLimit?: number;
    defaultLockLifetime?: number;
    sort?: any;
    mongo?: MongoDb;
    db?: {
        address: string;
        collection?: string;
        options?: MongoClientOptions;
    };
}
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
declare class Agenda extends EventEmitter {
    _defaultConcurrency: any;
    _defaultLockLifetime: any;
    _defaultLockLimit: any;
    _definitions: any;
    _findAndLockNextJob: (this: Agenda, jobName: string, definition: any) => Promise<Job<import("../job").JobAttributesData> | undefined>;
    _indices: any;
    _isLockingOnTheFly: boolean;
    _isJobQueueFilling: Map<string, boolean>;
    _jobQueue: JobProcessingQueue;
    _jobsToLock: Job[];
    _lockedJobs: Job[];
    _runningJobs: Job[];
    _lockLimit: any;
    _maxConcurrency: any;
    _mongoUseUnifiedTopology?: boolean;
    _name: any;
    _processEvery: number;
    _ready: Promise<unknown>;
    _sort: any;
    _db: MongoClient;
    _mdb: MongoDb;
    _collection: Collection;
    _nextScanAt: any;
    _processInterval: any;
    cancel: typeof cancel;
    close: typeof close;
    create: typeof create;
    database: typeof database;
    db_init: typeof dbInit;
    defaultConcurrency: typeof defaultConcurrency;
    defaultLockLifetime: typeof defaultLockLifetime;
    defaultLockLimit: typeof defaultLockLimit;
    define: typeof define;
    disable: typeof disable;
    enable: typeof enable;
    every: typeof every;
    jobs: typeof jobs;
    lockLimit: typeof lockLimit;
    maxConcurrency: typeof maxConcurrency;
    mongo: typeof mongo;
    name: typeof name;
    now: typeof now;
    processEvery: typeof processEvery;
    purge: typeof purge;
    saveJob: typeof saveJob;
    schedule: typeof schedule;
    sort: typeof sort;
    start: typeof start;
    stop: typeof stop;
    /**
     * Constructs a new Agenda object.
     * @param config Optional configuration to initialize the Agenda.
     * @param cb Optional callback called with the MongoDB collection.
     */
    constructor(config?: AgendaConfig, cb?: (error: AnyError | undefined, collection: Collection<any> | null) => void);
}
export { Agenda };
//# sourceMappingURL=index.d.ts.map