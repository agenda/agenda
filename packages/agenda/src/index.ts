import { EventEmitter } from 'events';
import debug from 'debug';

import { ForkOptions } from 'child_process';
import type { IJobDefinition } from './types/JobDefinition.js';
import type { IAgendaConfig } from './types/AgendaConfig.js';
import type { IDbConfig, SortDirection } from './types/DbOptions.js';
import type { IAgendaBackend } from './types/AgendaBackend.js';
import type { INotificationChannel, IJobNotification } from './types/NotificationChannel.js';
import type { JobId } from './types/JobParameters.js';
import type { IJobRepository } from './types/JobRepository.js';
import type { IAgendaStatus } from './types/AgendaStatus.js';
import type {
	IJobsQueryOptions,
	IJobsResult,
	IJobsOverview
} from './types/JobQuery.js';
import type { IRemoveJobsOptions } from './types/JobRepository.js';
import { Job, JobWithId } from './Job.js';
import { JobPriority, parsePriority } from './utils/priority.js';
import { JobProcessor } from './JobProcessor.js';
import { calculateProcessEvery } from './utils/processEvery.js';
import { getCallerFilePath } from './utils/stack.js';

const log = debug('agenda');

const DefaultOptions = {
	processEvery: 5000,
	defaultConcurrency: 5,
	maxConcurrency: 20,
	defaultLockLimit: 0,
	lockLimit: 0,
	defaultLockLifetime: 10 * 60 * 1000,
	sort: { nextRunAt: 1, priority: -1 } as const,
	forkHelper: { path: 'dist/childWorker.js' }
};

/**
 * Agenda configuration options
 */
export interface IAgendaOptions {
	/** Unified backend for storage and optionally notifications */
	backend: IAgendaBackend;
	/** Name to identify this agenda instance */
	name?: string;
	/** Default number of concurrent jobs per job type */
	defaultConcurrency?: number;
	/** How often to poll for new jobs (string like '5 seconds' or milliseconds) */
	processEvery?: string | number;
	/** Maximum number of concurrent jobs globally */
	maxConcurrency?: number;
	/** Default max locked jobs per job type */
	defaultLockLimit?: number;
	/** Global max locked jobs */
	lockLimit?: number;
	/** Default lock lifetime in milliseconds */
	defaultLockLifetime?: number;
	/** Fork helper configuration for sandboxed workers */
	forkHelper?: { path: string; options?: ForkOptions };
	/** Whether this is a forked worker instance */
	forkedWorker?: boolean;
	/**
	 * Override notification channel from backend.
	 * Use this to mix storage from one system with notifications from another.
	 * e.g., MongoDB storage + Redis notifications
	 */
	notificationChannel?: INotificationChannel;
}

/**
 * Event names that Agenda emits
 */
export type AgendaEventName =
	| 'ready'
	| 'error'
	| 'fail'
	| 'success'
	| 'start'
	| 'complete'
	| `fail:${string}`
	| `success:${string}`
	| `start:${string}`
	| `complete:${string}`;

/**
 * @class
 */
export class Agenda extends EventEmitter {
	readonly attrs: IAgendaConfig & IDbConfig;

	public readonly forkedWorker?: boolean;

	public readonly forkHelper?: {
		path: string;
		options?: ForkOptions;
	};

	private backend: IAgendaBackend;

	db: IJobRepository;

	private notificationChannel?: INotificationChannel;

	// Lifecycle events
	on(event: 'ready', listener: () => void): this;
	on(event: 'error', listener: (error: Error) => void): this;

	// Job events (generic)
	on(event: 'fail', listener: (error: Error, job: JobWithId) => void): this;
	on(event: 'success', listener: (job: JobWithId) => void): this;
	on(event: 'start', listener: (job: JobWithId) => void): this;
	on(event: 'complete', listener: (job: JobWithId) => void): this;

	// Job-specific events (e.g., 'fail:myJobName')
	on(event: `fail:${string}`, listener: (error: Error, job: JobWithId) => void): this;
	on(event: `success:${string}`, listener: (job: JobWithId) => void): this;
	on(event: `start:${string}`, listener: (job: JobWithId) => void): this;
	on(event: `complete:${string}`, listener: (job: JobWithId) => void): this;

	// Implementation (eslint-disable needed because overloads provide the public type safety)
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	on(event: string, listener: (...args: any[]) => void): this {
		if (this.forkedWorker && event !== 'ready' && event !== 'error') {
			const warning = new Error(`calling on(${event}) during a forkedWorker has no effect!`);
			log('WARNING: %s %s', warning.message, warning.stack);
			return this;
		}
		return super.on(event, listener);
	}

	readonly definitions: {
		[name: string]: IJobDefinition;
	} = {};

	private jobProcessor?: JobProcessor;

	readonly ready: Promise<void>;

	isActiveJobProcessor(): boolean {
		return !!this.jobProcessor;
	}

	async runForkedJob(jobId: string) {
		const jobData = await this.db.getJobById(jobId);
		if (!jobData) {
			throw new Error('db entry not found');
		}
		const job = new Job(this, jobData);
		await job.runJob();
	}

	async getRunningStats(fullDetails = false): Promise<IAgendaStatus> {
		if (!this.jobProcessor) {
			throw new Error('agenda not running!');
		}
		return this.jobProcessor.getStatus(fullDetails);
	}

	/**
	 * @param config - Agenda configuration with backend
	 * @param cb - Optional callback after Agenda is ready
	 */
	constructor(config: IAgendaOptions, cb?: (error?: Error) => void) {
		super();

		this.attrs = {
			name: config.name || '',
			processEvery: calculateProcessEvery(config.processEvery) || DefaultOptions.processEvery,
			defaultConcurrency: config.defaultConcurrency || DefaultOptions.defaultConcurrency,
			maxConcurrency: config.maxConcurrency || DefaultOptions.maxConcurrency,
			defaultLockLimit: config.defaultLockLimit || DefaultOptions.defaultLockLimit,
			lockLimit: config.lockLimit || DefaultOptions.lockLimit,
			defaultLockLifetime: config.defaultLockLifetime || DefaultOptions.defaultLockLifetime,
			sort: DefaultOptions.sort
		};

		this.forkedWorker = config.forkedWorker;
		this.forkHelper = config.forkHelper;

		// Store backend and get repository
		this.backend = config.backend;
		this.db = config.backend.repository;

		// Notification channel priority: explicit config > backend's channel
		this.notificationChannel = config.notificationChannel ?? config.backend.notificationChannel;

		// Ready promise resolves when backend is connected
		this.ready = new Promise(resolve => {
			this.once('ready', resolve);
		});

		// Connect the backend
		this.backend.connect().then(() => this.emit('ready'));

		if (cb) {
			this.ready.then(() => cb());
		}
	}

	/**
	 * Set the sort query for finding next job
	 * Default is { nextRunAt: 1, priority: -1 }
	 * @param query
	 */
	sort(query: { [key: string]: SortDirection }): Agenda {
		log('Agenda.sort([Object])');
		this.attrs.sort = query;
		return this;
	}

	/**
	 * Cancels any jobs matching the passed options, and removes them from the database.
	 * @param options Options for which jobs to cancel
	 */
	async cancel(options: IRemoveJobsOptions): Promise<number> {
		log('attempting to cancel all Agenda jobs', options);
		try {
			const amountOfRemovedJobs = await this.db.removeJobs(options);
			log('%s jobs cancelled', amountOfRemovedJobs);
			return amountOfRemovedJobs;
		} catch (error) {
			log('error trying to delete jobs from database');
			throw error;
		}
	}

	/**
	 * Set name of queue
	 * @param name
	 */
	name(name: string): Agenda {
		log('Agenda.name(%s)', name);
		this.attrs.name = name;
		return this;
	}

	/**
	 * Set the time how often the job processor checks for new jobs to process
	 * @param time
	 */
	processEvery(time: string | number): Agenda {
		if (this.jobProcessor) {
			throw new Error(
				'job processor is already running, you need to set processEvery before calling start'
			);
		}
		log('Agenda.processEvery(%d)', time);
		this.attrs.processEvery = calculateProcessEvery(time);
		return this;
	}

	/**
	 * Set the concurrency for jobs (globally), type does not matter
	 * @param num
	 */
	maxConcurrency(num: number): Agenda {
		log('Agenda.maxConcurrency(%d)', num);
		this.attrs.maxConcurrency = num;
		return this;
	}

	/**
	 * Set the default concurrency for each job
	 * @param num number of max concurrency
	 */
	defaultConcurrency(num: number): Agenda {
		log('Agenda.defaultConcurrency(%d)', num);
		this.attrs.defaultConcurrency = num;
		return this;
	}

	/**
	 * Set the default amount jobs that are allowed to be locked at one time (GLOBAL)
	 * @param num
	 */
	lockLimit(num: number): Agenda {
		log('Agenda.lockLimit(%d)', num);
		this.attrs.lockLimit = num;
		return this;
	}

	/**
	 * Set default lock limit per job type
	 * @param num
	 */
	defaultLockLimit(num: number): Agenda {
		log('Agenda.defaultLockLimit(%d)', num);
		this.attrs.defaultLockLimit = num;
		return this;
	}

	/**
	 * Set the default lock time (in ms)
	 * Default is 10 * 60 * 1000 ms (10 minutes)
	 * @param ms
	 */
	defaultLockLifetime(ms: number): Agenda {
		log('Agenda.defaultLockLifetime(%d)', ms);
		this.attrs.defaultLockLifetime = ms;
		return this;
	}

	/**
	 * Set a notification channel for real-time job notifications
	 * @param channel - The notification channel implementation
	 */
	notifyVia(channel: INotificationChannel): Agenda {
		if (this.jobProcessor) {
			throw new Error(
				'job processor is already running, you need to set notificationChannel before calling start'
			);
		}
		log('Agenda.notifyVia([INotificationChannel])');
		this.notificationChannel = channel;
		return this;
	}

	/**
	 * Check if a notification channel is configured
	 */
	hasNotificationChannel(): boolean {
		return !!this.notificationChannel;
	}

	/**
	 * Publish a job notification to the notification channel
	 * @internal
	 */
	async publishJobNotification(job: Job): Promise<void> {
		if (!this.notificationChannel || this.notificationChannel.state !== 'connected') {
			// Channel not configured or not connected - skip publishing
			return;
		}

		const notification: IJobNotification = {
			jobId: job.attrs._id as JobId,
			jobName: job.attrs.name,
			nextRunAt: job.attrs.nextRunAt,
			priority: job.attrs.priority,
			timestamp: new Date(),
			source: this.attrs.name || undefined
		};

		try {
			await this.notificationChannel.publish(notification);
			log('published job notification for [%s:%s]', job.attrs.name, job.attrs._id);
		} catch (error) {
			log('failed to publish job notification for [%s:%s]', job.attrs.name, job.attrs._id, error);
			this.emit('error', error);
		}
	}

	/**
	 * Query jobs with database-agnostic options.
	 * Returns jobs with computed states and supports filtering by state.
	 *
	 * @param options - Query options (name, state, search, pagination)
	 * @returns Jobs with computed states and total count
	 */
	async queryJobs(options?: IJobsQueryOptions): Promise<IJobsResult> {
		return this.db.queryJobs(options);
	}

	/**
	 * Get overview statistics for jobs grouped by name.
	 * Returns counts of jobs in each state for each job name.
	 *
	 * @returns Array of job overviews with state counts
	 */
	async getJobsOverview(): Promise<IJobsOverview[]> {
		return this.db.getJobsOverview();
	}

	/**
	 * Removes all jobs from queue
	 * @note: Only use after defining your jobs
	 */
	async purge(): Promise<number> {
		const definedNames = Object.keys(this.definitions);
		log('Agenda.purge(%o)', definedNames);
		return this.cancel({ notNames: definedNames });
	}

	/**
	 * Setup definition for job
	 * Method is used by consumers of lib to setup their functions
	 * BREAKING CHANGE in v4: options moved from 2nd to 3rd parameter!
	 * @param name
	 * @param processor
	 * @param options
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	define<DATA = any>(
		name: string,
		processor: (agendaJob: Job<DATA>, done: (error?: Error) => void) => void,
		options?: Partial<Pick<IJobDefinition, 'lockLimit' | 'lockLifetime' | 'concurrency'>> & {
			priority?: JobPriority;
		}
	): void;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	define<DATA = any>(
		name: string,
		processor: (agendaJob: Job<DATA>) => Promise<void>,
		options?: Partial<Pick<IJobDefinition, 'lockLimit' | 'lockLifetime' | 'concurrency'>> & {
			priority?: JobPriority;
		}
	): void;
	define(
		name: string,
		processor: ((job: Job) => Promise<void>) | ((job: Job, done: (err?: Error) => void) => void),
		options?: Partial<Pick<IJobDefinition, 'lockLimit' | 'lockLifetime' | 'concurrency'>> & {
			priority?: JobPriority;
		}
	): void {
		if (this.definitions[name]) {
			log('overwriting already defined agenda job', name);
		}

		const filePath = getCallerFilePath();

		this.definitions[name] = {
			fn: processor as IJobDefinition['fn'],
			filePath,
			concurrency: options?.concurrency || this.attrs.defaultConcurrency,
			lockLimit: options?.lockLimit || this.attrs.defaultLockLimit,
			priority: parsePriority(options?.priority),
			lockLifetime: options?.lockLifetime || this.attrs.defaultLockLifetime
		};
		log('job [%s] defined with following options: \n%O', name, this.definitions[name]);
	}

	/**
	 * Internal helper method that uses createJob to create jobs for an array of names
	 * @param names - Job names to schedule
	 * @param createJob - Factory function to create each job
	 * @returns Array of created jobs
	 */
	private async createJobs<DATA = unknown>(
		names: string[],
		createJob: (name: string) => Promise<Job<DATA>>
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

	/**
	 * Given a name and some data, create a new job
	 * @param name
	 */
	create(name: string): Job<void>;
	create<DATA = unknown>(name: string, data: DATA): Job<DATA>;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	create(name: string, data?: unknown): Job<any> {
		log('Agenda.create(%s, [Object])', name);
		const priority = this.definitions[name] ? this.definitions[name].priority : 0;
		return new Job(this, { name, data, type: 'normal', priority });
	}

	/**
	 * Creates a scheduled job with given interval and name/names of the job to run
	 * @param interval
	 * @param names
	 * @param data
	 * @param options
	 */
	async every(
		interval: string | number,
		names: string[],
		data?: undefined,
		options?: { timezone?: string; skipImmediate?: boolean; forkMode?: boolean }
	): Promise<Job<void>[]>;
	async every(
		interval: string | number,
		name: string,
		data?: undefined,
		options?: { timezone?: string; skipImmediate?: boolean; forkMode?: boolean }
	): Promise<Job<void>>;
	async every<DATA = unknown>(
		interval: string | number,
		names: string[],
		data: DATA,
		options?: { timezone?: string; skipImmediate?: boolean; forkMode?: boolean }
	): Promise<Job<DATA>[]>;
	async every<DATA = unknown>(
		interval: string | number,
		name: string,
		data: DATA,
		options?: { timezone?: string; skipImmediate?: boolean; forkMode?: boolean }
	): Promise<Job<DATA>>;
	async every(
		interval: string | number,
		names: string | string[],
		data?: unknown,
		options?: { timezone?: string; skipImmediate?: boolean; forkMode?: boolean }
	): // eslint-disable-next-line @typescript-eslint/no-explicit-any
	Promise<Job<any> | Job<any>[]> {
		log('Agenda.every(%s, %O, %O)', interval, names, options);

		/** Internal method to setup job that gets run every interval */
		const createJob = async (name: string): Promise<Job> => {
			const job = this.create(name, data);
			job.attrs.type = 'single';
			job.repeatEvery(interval, options);
			if (options?.forkMode) {
				job.forkMode(options.forkMode);
			}
			await job.save();

			return job;
		};

		if (typeof names === 'string') {
			return createJob(names);
		}

		log('Agenda.every(%s, %s, %O)', interval, names, options);
		return this.createJobs(names, createJob);
	}

	/**
	 * Schedule a job or jobs at a specific time
	 * @param when
	 * @param names
	 */
	async schedule<DATA = void>(when: string | Date, names: string[]): Promise<Job<DATA>[]>;
	async schedule<DATA = void>(when: string | Date, names: string): Promise<Job<DATA>>;
	async schedule<DATA = unknown>(
		when: string | Date,
		names: string[],
		data: DATA
	): Promise<Job<DATA>[]>;
	async schedule<DATA = unknown>(when: string | Date, name: string, data: DATA): Promise<Job<DATA>>;
	async schedule(
		when: string | Date,
		names: string | string[],
		data?: unknown
	): Promise<Job | Job[]> {
		const createJob = async (name: string) => {
			const job = this.create(name, data);

			await job.schedule(when).save();

			return job;
		};

		if (typeof names === 'string') {
			log('Agenda.schedule(%s, %O, [%O])', when, names);
			return createJob(names);
		}

		log('Agenda.schedule(%s, %O, [%O])', when, names);
		return this.createJobs(names, createJob);
	}

	/**
	 * Create a job for this exact moment
	 * @param name
	 */
	async now<DATA = void>(name: string): Promise<Job<DATA>>;
	async now<DATA = unknown>(name: string, data: DATA): Promise<Job<DATA>>;
	async now<DATA>(name: string, data?: DATA): Promise<Job<DATA | void>> {
		log('Agenda.now(%s, [Object])', name);
		try {
			const job = this.create(name, data);

			job.schedule(new Date());
			await job.save();

			return job as Job<DATA | void>;
		} catch (error) {
			log('error trying to create a job for this exact moment');
			throw error;
		}
	}

	/**
	 * Starts processing jobs using processJobs() methods, storing an interval ID
	 * This method will only resolve if a db has been set up beforehand.
	 */
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

		// Connect notification channel if configured
		if (this.notificationChannel) {
			log('Agenda.start connecting notification channel');
			await this.notificationChannel.connect();
		}

		this.jobProcessor = new JobProcessor(
			this,
			this.attrs.maxConcurrency,
			this.attrs.lockLimit,
			this.attrs.processEvery,
			this.notificationChannel
		);
	}

	/**
	 * Clear the interval that processes the jobs and unlocks all currently locked jobs
	 */
	async stop(): Promise<void> {
		if (!this.jobProcessor) {
			log('Agenda.stop called, but agenda has never started!');
			return;
		}

		log('Agenda.stop called, clearing interval for processJobs()');

		const lockedJobs = this.jobProcessor.stop();

		log('Agenda._unlockJobs()');
		const jobIds = lockedJobs?.map(job => job.attrs._id) || [];

		if (jobIds.length > 0) {
			log('about to unlock jobs with ids: %O', jobIds);
			await this.db.unlockJobs(jobIds);
		}

		// Disconnect notification channel if configured
		if (this.notificationChannel) {
			log('Agenda.stop disconnecting notification channel');
			await this.notificationChannel.disconnect();
		}

		// Disconnect the backend
		log('Agenda.stop disconnecting backend');
		await this.backend.disconnect();

		this.jobProcessor = undefined;
	}

	/**
	 * Waits for all currently running jobs to finish before stopping.
	 * This allows for a graceful shutdown where jobs complete their work.
	 * Unlike stop(), this method waits for running jobs to complete instead of unlocking them.
	 */
	async drain(): Promise<void> {
		if (!this.jobProcessor) {
			log('Agenda.drain called, but agenda has never started!');
			return;
		}

		log('Agenda.drain called, waiting for jobs to finish');

		await this.jobProcessor.drain();

		// Disconnect notification channel if configured
		if (this.notificationChannel) {
			log('Agenda.drain disconnecting notification channel');
			await this.notificationChannel.disconnect();
		}

		// Disconnect the backend
		log('Agenda.drain disconnecting backend');
		await this.backend.disconnect();

		this.jobProcessor = undefined;
	}
}

export * from './types/AgendaConfig.js';

export * from './types/JobDefinition.js';

export * from './types/JobParameters.js';

export * from './types/DbOptions.js';

export * from './Job.js';

export * from './types/JobQuery.js';

export * from './types/JobRepository.js';

export * from './types/NotificationChannel.js';

export * from './types/AgendaBackend.js';

export * from './notifications/index.js';
