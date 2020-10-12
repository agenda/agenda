import { EventEmitter } from 'events';
import * as debug from 'debug';

import * as humanInterval from 'human-interval';
import { Db, MongoClientOptions } from 'mongodb';
import { Job } from './Job';
import { JobProcessor } from './JobProcessor';
import type { IJobDefinition } from './types/JobDefinition';
import { IAgendaConfig } from './types/AgendaConfig';
import { JobDbRepository } from './JobDbRepository';
import { IDatabaseOptions, IDbConfig, IMongoOptions } from './types/DbOptions';
import { filterUndef } from './utils/helpers';
import { parsePriority } from './utils/priority';

const log = debug('agenda');

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
 * @property {Object} definitions
 * @property {Object} _runningJobs
 * @property {Object} _lockedJobs
 * @property {Object} _jobQueue
 * @property {Number} _defaultLockLifetime
 * @property {Object} _sort
 * @property {Object} _indices
 * @property {Boolean} _isLockingOnTheFly
 * @property {Array} _jobsToLock
 */
export class Agenda extends EventEmitter {
	readonly attrs: IAgendaConfig & IDbConfig;

	db: JobDbRepository;
	// eslint-disable-next-line default-param-last
	// private jobQueue: JobProcessingQueue;

	readonly definitions: {
		[name: string]: IJobDefinition;
	} = {};

	private jobProcessor?: JobProcessor;

	private ready: Promise<unknown>;

	getRunningStats() {
		if (!this.jobProcessor) {
			throw new Error('agenda not running!');
		}
		return this.jobProcessor.getStatus();
	}

	constructor(
		config: {
			name?: string;
			defaultConcurrency?: number;
			processEvery?: string;
			maxConcurrency?: number;
			defaultLockLimit?: number;
			lockLimit?: number;
			defaultLockLifetime?: number;
			// eslint-disable-next-line @typescript-eslint/ban-types
		} & (IDatabaseOptions | IMongoOptions | {}) &
			IDbConfig = {},
		cb?
	) {
		super();

		this.attrs = {
			name: config.name || '',
			processEvery: humanInterval(config.processEvery) || humanInterval('5 seconds'),
			defaultConcurrency: config.defaultConcurrency || 5,
			maxConcurrency: config.maxConcurrency || 20,
			defaultLockLimit: config.defaultLockLimit || 0,
			lockLimit: config.lockLimit || 0,
			defaultLockLifetime: config.defaultLockLifetime || 10 * 60 * 1000, // 10 minute default lockLifetime
			sort: config.sort || { nextRunAt: 1, priority: -1 }
		};

		this.ready = new Promise(resolve => this.once('ready', resolve));

		if (this.hasDatabaseConfig(config)) {
			this.db = new JobDbRepository(this, config);
			this.db.connect();
		}

		if (cb) {
			this.ready.then(cb);
		}
	}

	async database(
		address: string,
		collection?: string,
		options?: MongoClientOptions
	): Promise<Agenda> {
		this.db = new JobDbRepository(this, { db: { address, collection, options } });
		await this.db.connect();
		return this;
	}

	async mongo(mongo: Db, options?: IMongoOptions['db']): Promise<Agenda> {
		this.db = new JobDbRepository(this, { mongo, db: options });
		await this.db.connect();
		return this;
	}

	sort(query): Agenda {
		log('Agenda.sort([Object])');
		this.attrs.sort = query;
		return this;
	}

	private hasDatabaseConfig(config: any): config is (IDatabaseOptions | IMongoOptions) & IDbConfig {
		return !!(config.db?.address || config.mongo);
	}

	async cancel(query: any): Promise<number> {
		log('attempting to cancel all Agenda jobs', query);
		try {
			const { result } = await this.db.removeJobs(query);
			log('%s jobs cancelled', result.n);
			return result.n || 0;
		} catch (error) {
			log('error trying to delete jobs from MongoDB');
			throw error;
		}
	}

	name(name): Agenda {
		log('Agenda.name(%s)', name);
		this.attrs.name = name;
		return this;
	}

	processEvery(time: string | number): Agenda {
		log('Agenda.processEvery(%d)', time);
		this.attrs.processEvery = humanInterval(time);
		return this;
	}

	maxConcurrency(num: number): Agenda {
		log('Agenda.maxConcurrency(%d)', num);
		this.attrs.maxConcurrency = num;
		return this;
	}

	defaultConcurrency(num: number): Agenda {
		log('Agenda.defaultConcurrency(%d)', num);
		this.attrs.defaultConcurrency = num;
		return this;
	}

	lockLimit(num: number): Agenda {
		log('Agenda.lockLimit(%d)', num);
		this.attrs.lockLimit = num;
		return this;
	}

	defaultLockLimit(num: number): Agenda {
		log('Agenda.defaultLockLimit(%d)', num);
		this.attrs.defaultLockLimit = num;
		return this;
	}

	defaultLockLifetime(ms: number): Agenda {
		log('Agenda.defaultLockLifetime(%d)', ms);
		this.attrs.defaultLockLifetime = ms;
		return this;
	}

	async jobs(query: any = {}, sort: any = {}, limit = 0, skip = 0): Promise<Job[]> {
		const result = await this.db.getJobs(query, sort, limit, skip);

		return result.map(job => new Job(this, job));
	}

	/**
	 * @note: Only use after defining your jobs
	 */
	async purge(): Promise<number> {
		const definedNames = Object.keys(this.definitions);
		log('Agenda.purge(%o)', definedNames);
		return this.cancel({ name: { $not: { $in: definedNames } } });
	}

	/** BREAKING CHANGE: options moved from 2nd to 3rd parameter! */
	define<DATA = any>(
		name: string,
		processor: (agendaJob: Job<DATA>, done: (err?) => void) => void,
		options?: Partial<Pick<IJobDefinition, 'lockLimit' | 'lockLifetime' | 'concurrency'>> & {
			priority?: 'lowest' | 'low' | 'normal' | 'high' | 'highest' | number;
		}
	);
	define<DATA = any>(
		name: string,
		processor: (agendaJob: Job<DATA>) => Promise<void>,
		options?: Partial<Pick<IJobDefinition, 'lockLimit' | 'lockLifetime' | 'concurrency'>> & {
			priority?: 'lowest' | 'low' | 'normal' | 'high' | 'highest' | number;
		}
	);
	define(
		name: string,
		processor,
		options?: Partial<Pick<IJobDefinition, 'lockLimit' | 'lockLifetime' | 'concurrency'>> & {
			priority?: 'lowest' | 'low' | 'normal' | 'high' | 'highest' | number;
		}
	): void {
		this.definitions[name] = {
			fn: processor,
			concurrency: options?.concurrency || this.attrs.defaultConcurrency,
			lockLimit: options?.lockLimit || this.attrs.defaultLockLimit,
			priority: parsePriority(options?.priority) || 0,
			lockLifetime: options?.lockLifetime || this.attrs.defaultLockLifetime
		};
		log('job [%s] defined with following options: \n%O', name, this.definitions[name]);
	}

	/**
	 * Internal helper method that uses createJob to create jobs for an array of names
	 * @param {Number} interval run every X interval
	 * @param {Array<String>} names Strings of jobs to schedule
	 * @param {Object} data data to run for job
	 * @param {Object} options options to run job for
	 * @returns {Array<Job>} array of jobs created
	 */
	private async createJobs<DATA = any>(
		names: string[],
		createJob: (name) => Promise<Job<DATA>>
	): Promise<Job<DATA>[]> {
		try {
			const jobs = await Promise.all(names.map(name => createJob(name)));

			log('createJobs() -> all jobs created successfully');

			return jobs;
		} catch (error) {
			log('createJobs() -> error creating one or more of the jobs', error);
			throw error;
		}
	}

	create(name: string): Job<void>;
	create<DATA = any>(name: string, data: DATA): Job<DATA>;
	create(name: string, data?: any) {
		log('Agenda.create(%s, [Object])', name);
		const priority = this.definitions[name] ? this.definitions[name].priority : 0;
		const job = new Job(this, { name, data, type: 'normal', priority });
		return job;
	}

	async every(
		interval: string | number,
		names: string[],
		data?: undefined,
		options?: { timezone?: string; skipImmediate?: boolean }
	): Promise<Job<void>[]>;
	async every(
		interval: string | number,
		names: string,
		data?: undefined,
		options?: { timezone?: string; skipImmediate?: boolean }
	): Promise<Job<void>>;
	async every<DATA = any>(
		interval: string | number,
		names: string[],
		data: DATA,
		options?: { timezone?: string; skipImmediate?: boolean }
	): Promise<Job<DATA>[]>;
	async every<DATA = any>(
		interval: string | number,
		names: string,
		data: DATA,
		options?: { timezone?: string; skipImmediate?: boolean }
	): Promise<Job<DATA>>;
	async every(
		interval: string | number,
		names: string | string[],
		data?: any,
		options?: { timezone?: string; skipImmediate?: boolean }
	) {
		/**
		 * Internal method to setup job that gets run every interval
		 * @param {Number} interval run every X interval
		 * @param {String} name String job to schedule
		 * @param {Object} data data to run for job
		 * @param {Object} options options to run job for
		 * @returns {Job} instance of job
		 */
		log('Agenda.every(%s, %O, %O)', interval, names, options);

		const createJob = async (name: string): Promise<Job> => {
			const job = this.create(name, data);
			job.attrs.type = 'single';
			job.repeatEvery(interval, options);
			await job.save();

			return job;
		};

		if (typeof names === 'string') {
			const job = await createJob(names);

			return job;
		}

		log('Agenda.every(%s, %s, %O)', interval, names, options);
		const jobs = await this.createJobs(names, createJob);

		return jobs;
	}

	async schedule<DATA = void>(when: string | Date, names: string[]): Promise<Job<DATA>[]>;
	async schedule<DATA = void>(when: string | Date, names: string): Promise<Job<DATA>>;
	async schedule<DATA = any>(
		when: string | Date,
		names: string[],
		data: DATA
	): Promise<Job<DATA>[]>;
	async schedule<DATA = any>(when: string | Date, names: string, data: DATA): Promise<Job<DATA>>;
	async schedule(when: string | Date, names: string | string[], data?: any) {
		const createJob = async name => {
			const job = this.create(name, data);

			await job.schedule(when).save();

			return job;
		};

		if (typeof names === 'string') {
			log('Agenda.schedule(%s, %O, [%O], cb)', when, names);
			return createJob(names);
		}

		log('Agenda.schedule(%s, %O, [%O])', when, names);
		return this.createJobs(names, createJob);
	}

	async now<DATA = void>(name: string): Promise<Job<DATA>>;
	async now<DATA = any>(name: string, data: DATA): Promise<Job<DATA>>;
	async now<DATA>(name: string, data?: DATA): Promise<Job<DATA | void>> {
		log('Agenda.now(%s, [Object])', name);
		try {
			const job = this.create(name, data);

			job.schedule(new Date());
			await job.save();

			return job;
		} catch (error) {
			log('error trying to create a job for this exact moment');
			throw error;
		}
	}

	async start(): Promise<void> {
		log(
			'Agenda.start called, waiting for agenda to be initialized (db connection)',
			this.attrs.processEvery
		);
		await this.ready;
		if (this.jobProcessor) {
			log('Agenda.start was already called, ignoring');
			return;
		}

		this.jobProcessor = new JobProcessor(
			this,
			this.attrs.maxConcurrency,
			this.attrs.lockLimit,
			this.attrs.processEvery
		);

		await this.jobProcessor.process();

		this.on('processJob', this.jobProcessor.process.bind(this.jobProcessor));
	}

	async stop(): Promise<void> {
		if (!this.jobProcessor) {
			log('Agenda.stop called, but agenda has never started!');
			return;
		}

		log('Agenda.stop called, clearing interval for processJobs()');

		const lockedJobs = this.jobProcessor?.stop();

		log('Agenda._unlockJobs()');
		const jobIds = filterUndef(lockedJobs?.map(job => job.attrs._id) || []);

		if (jobIds.length > 0) {
			log('about to unlock jobs with ids: %O', jobIds);
			await this.db.unlockJobs(jobIds);
		}

		this.off('processJob', this.jobProcessor.process);

		this.jobProcessor = undefined;
	}

	// fina;
	// Agenda.prototype.saveJob = save_job; -> moved to JobDbRepository

	// Agenda.prototype._findAndLockNextJob = find_and_lock_next_job; -> moved to JobProcessor
}

export * from './types/AgendaConfig';

export * from './types/JobDefinition';

export * from './types/JobParameters';

export * from './types/DbOptions';

export * from './Job';
