import { EventEmitter } from 'events';
import debug from 'debug';

import { ForkOptions } from 'child_process';
import type { JobDefinition } from './types/JobDefinition.js';
import type { AgendaConfig } from './types/AgendaConfig.js';
import type { AgendaBackend } from './types/AgendaBackend.js';
import type {
	NotificationChannel,
	JobNotification,
	JobStateNotification,
	JobStateType
} from './types/NotificationChannel.js';
import type { JobId } from './types/JobParameters.js';
import type { JobRepository } from './types/JobRepository.js';
import type { AgendaStatus } from './types/AgendaStatus.js';
import type { JobsQueryOptions, JobsResult, JobsOverview } from './types/JobQuery.js';
import type { RemoveJobsOptions } from './types/JobRepository.js';
import type { DrainOptions, DrainResult } from './types/DrainOptions.js';
import type { Logger } from './types/Logger.js';
import type { JobLogger, JobLogEntry, JobLogQuery, JobLogQueryResult } from './types/JobLogger.js';
import { Job, JobWithId } from './Job.js';
import { JobPriority, parsePriority } from './utils/priority.js';
import { JobProcessor } from './JobProcessor.js';
import { calculateProcessEvery } from './utils/processEvery.js';
import { getCallerFilePath } from './utils/stack.js';
import { DebugLogger } from './logging/DebugLogger.js';
import { NoopLogger } from './logging/NoopLogger.js';

const log = debug('agenda');

const DefaultOptions = {
	processEvery: 5000,
	defaultConcurrency: 5,
	maxConcurrency: 20,
	defaultLockLimit: 0,
	lockLimit: 0,
	defaultLockLifetime: 10 * 60 * 1000,
	forkHelper: { path: 'dist/childWorker.js' },
	removeOnComplete: false
};

/**
 * Agenda configuration options
 */
export interface AgendaOptions {
	/** Unified backend for storage and optionally notifications */
	backend: AgendaBackend;
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
	/** Automatically remove one-time jobs from database after successful completion */
	removeOnComplete?: boolean;
	/** Fork helper configuration for sandboxed workers */
	forkHelper?: { path: string; options?: ForkOptions };
	/** Whether this is a forked worker instance */
	forkedWorker?: boolean;
	/**
	 * Override notification channel from backend.
	 * Use this to mix storage from one system with notifications from another.
	 * e.g., MongoDB storage + Redis notifications
	 */
	notificationChannel?: NotificationChannel;
	/**
	 * Pluggable logger for console/debug output of job lifecycle events.
	 *
	 * Disabled by default. Must be explicitly enabled:
	 * - Pass `true` to enable the default `DebugLogger` (uses the `debug` library, controlled via `DEBUG=agenda:*`)
	 * - Pass a `Logger` implementation for custom logging (e.g., winston, pino)
	 * - Omit or pass `false` to disable (default)
	 *
	 * @example
	 * ```typescript
	 * // Enable default debug logger
	 * const agenda = new Agenda({ backend, logger: true });
	 *
	 * // Custom logger
	 * const agenda = new Agenda({ backend, logger: myWinstonLogger });
	 * ```
	 */
	logger?: Logger | boolean;
	/**
	 * Enable persistent job event logging (stored in the backend's database).
	 *
	 * Disabled by default. Must be explicitly enabled:
	 * - Pass `true` to use the backend's built-in job logger (backend must support it via `logging: true`)
	 * - Pass a `JobLogger` implementation for custom persistent logging
	 * - Omit or pass `false` to disable (default)
	 *
	 * When enabled, all job lifecycle events (start, success, fail, complete, retry, etc.)
	 * are persisted and can be queried via `agenda.getLogs()` or viewed in agendash.
	 *
	 * @example
	 * ```typescript
	 * // Enable with backend's built-in logger
	 * const agenda = new Agenda({
	 *   backend: new PostgresBackend({ connectionString: '...', logging: true }),
	 *   logging: true
	 * });
	 *
	 * // Query logs
	 * const { entries } = await agenda.getLogs({ jobName: 'myJob', limit: 100 });
	 * ```
	 */
	logging?: JobLogger | boolean;
}

/**
 * Details provided when a job is scheduled for retry
 */
export interface RetryDetails {
	/** The retry attempt number (1-based) */
	attempt: number;
	/** Delay in milliseconds before the retry */
	delay: number;
	/** When the retry will be executed */
	nextRunAt: Date;
	/** The error that caused the failure */
	error: Error;
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
	| 'retry'
	| 'retry exhausted'
	| `fail:${string}`
	| `success:${string}`
	| `start:${string}`
	| `complete:${string}`
	| `retry:${string}`
	| `retry exhausted:${string}`;

/**
 * @class
 */
export class Agenda extends EventEmitter {
	readonly attrs: AgendaConfig;

	public readonly forkedWorker?: boolean;

	public readonly forkHelper?: {
		path: string;
		options?: ForkOptions;
	};

	private backend: AgendaBackend;

	db: JobRepository;

	private notificationChannel?: NotificationChannel;

	private stateSubscriptionUnsubscribe?: () => void;

	/**
	 * The pluggable logger instance for console/debug output.
	 * Disabled by default (NoopLogger). Enable via `logger: true` or a custom Logger.
	 */
	public logger: Logger;

	/**
	 * The persistent job logger for storing job lifecycle events in the database.
	 * Disabled by default. Enable via `logging: true` (uses backend's built-in logger)
	 * or by passing a custom `JobLogger` implementation.
	 */
	public jobLogger?: JobLogger;

	// Lifecycle events
	on(event: 'ready', listener: () => void): this;
	on(event: 'error', listener: (error: Error) => void): this;

	// Job events (generic)
	// Local events: `remote` is undefined, first param is JobWithId
	// Remote events: `remote` is true, first param is JobStateNotification
	on(event: 'fail', listener: (error: Error, job: JobWithId, remote?: false) => void): this;
	on(event: 'fail', listener: (error: string, job: JobStateNotification, remote: true) => void): this;
	on(event: 'success', listener: (job: JobWithId, remote?: false) => void): this;
	on(event: 'success', listener: (job: JobStateNotification, remote: true) => void): this;
	on(event: 'start', listener: (job: JobWithId, remote?: false) => void): this;
	on(event: 'start', listener: (job: JobStateNotification, remote: true) => void): this;
	on(event: 'complete', listener: (job: JobWithId, remote?: false) => void): this;
	on(event: 'complete', listener: (job: JobStateNotification, remote: true) => void): this;
	on(event: 'progress', listener: (job: JobWithId, remote?: false) => void): this;
	on(event: 'progress', listener: (job: JobStateNotification, remote: true) => void): this;

	// Retry events (generic)
	on(event: 'retry', listener: (job: JobWithId, details: RetryDetails, remote?: false) => void): this;
	on(event: 'retry', listener: (job: JobStateNotification, details: RetryDetails, remote: true) => void): this;
	on(event: 'retry exhausted', listener: (error: Error, job: JobWithId) => void): this;

	// Job-specific events (e.g., 'fail:myJobName')
	// Local events: `remote` is undefined, first param is JobWithId
	// Remote events: `remote` is true, first param is JobStateNotification
	on(event: `fail:${string}`, listener: (error: Error, job: JobWithId, remote?: false) => void): this;
	on(event: `fail:${string}`, listener: (error: string, job: JobStateNotification, remote: true) => void): this;
	on(event: `success:${string}`, listener: (job: JobWithId, remote?: false) => void): this;
	on(event: `success:${string}`, listener: (job: JobStateNotification, remote: true) => void): this;
	on(event: `start:${string}`, listener: (job: JobWithId, remote?: false) => void): this;
	on(event: `start:${string}`, listener: (job: JobStateNotification, remote: true) => void): this;
	on(event: `complete:${string}`, listener: (job: JobWithId, remote?: false) => void): this;
	on(event: `complete:${string}`, listener: (job: JobStateNotification, remote: true) => void): this;
	on(event: `progress:${string}`, listener: (job: JobWithId, remote?: false) => void): this;
	on(event: `progress:${string}`, listener: (job: JobStateNotification, remote: true) => void): this;
	on(event: `retry:${string}`, listener: (job: JobWithId, details: RetryDetails, remote?: false) => void): this;
	on(event: `retry:${string}`, listener: (job: JobStateNotification, details: RetryDetails, remote: true) => void): this;
	on(event: `retry exhausted:${string}`, listener: (error: Error, job: JobWithId) => void): this;

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
		[name: string]: JobDefinition;
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

	async getRunningStats(fullDetails = false): Promise<AgendaStatus> {
		if (!this.jobProcessor) {
			throw new Error('agenda not running!');
		}
		const status = await this.jobProcessor.getStatus(fullDetails);

		// Add backend info (stored in Agenda, not JobProcessor)
		status.backend = {
			name: this.backend.name,
			hasNotificationChannel: this.hasNotificationChannel()
		};

		return status;
	}

	/**
	 * @param config - Agenda configuration with backend
	 * @param cb - Optional callback after Agenda is ready
	 */
	constructor(config: AgendaOptions, cb?: (error?: Error) => void) {
		super();

		this.attrs = {
			name: config.name || '',
			processEvery: calculateProcessEvery(config.processEvery) || DefaultOptions.processEvery,
			defaultConcurrency: config.defaultConcurrency || DefaultOptions.defaultConcurrency,
			maxConcurrency: config.maxConcurrency || DefaultOptions.maxConcurrency,
			defaultLockLimit: config.defaultLockLimit || DefaultOptions.defaultLockLimit,
			lockLimit: config.lockLimit || DefaultOptions.lockLimit,
			defaultLockLifetime: config.defaultLockLifetime || DefaultOptions.defaultLockLifetime,
			removeOnComplete: config.removeOnComplete ?? DefaultOptions.removeOnComplete
		};

		this.forkedWorker = config.forkedWorker;
		this.forkHelper = config.forkHelper;

		// Initialize console/debug logger: disabled by default
		if (config.logger === true) {
			this.logger = new DebugLogger();
		} else if (typeof config.logger === 'object') {
			this.logger = config.logger;
		} else {
			this.logger = new NoopLogger();
		}

		// Initialize persistent job logger: disabled by default
		if (config.logging === true) {
			// Use backend's built-in logger (must be configured on the backend)
			this.jobLogger = config.backend.logger;
		} else if (typeof config.logging === 'object') {
			// Use custom JobLogger
			this.jobLogger = config.logging;
		}

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
	 * Cancels any jobs matching the passed options, and removes them from the database.
	 * @param options Options for which jobs to cancel
	 */
	async cancel(options: RemoveJobsOptions): Promise<number> {
		log('attempting to cancel all Agenda jobs', options);
		await this.ready;
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
	 * Disables any jobs matching the passed options, preventing them from being run.
	 * @param options Options for which jobs to disable
	 * @returns Number of jobs disabled
	 */
	async disable(options: RemoveJobsOptions): Promise<number> {
		log('attempting to disable Agenda jobs', options);
		await this.ready;
		try {
			const numDisabled = await this.db.disableJobs(options);
			log('%s jobs disabled', numDisabled);
			return numDisabled;
		} catch (error) {
			log('error trying to disable jobs');
			throw error;
		}
	}

	/**
	 * Enables any jobs matching the passed options, allowing them to be run.
	 * @param options Options for which jobs to enable
	 * @returns Number of jobs enabled
	 */
	async enable(options: RemoveJobsOptions): Promise<number> {
		log('attempting to enable Agenda jobs', options);
		await this.ready;
		try {
			const numEnabled = await this.db.enableJobs(options);
			log('%s jobs enabled', numEnabled);
			return numEnabled;
		} catch (error) {
			log('error trying to enable jobs');
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
	notifyVia(channel: NotificationChannel): Agenda {
		if (this.jobProcessor) {
			throw new Error(
				'job processor is already running, you need to set notificationChannel before calling start'
			);
		}
		log('Agenda.notifyVia([NotificationChannel])');
		this.notificationChannel = channel;
		return this;
	}

	/**
	 * Set a pluggable logger for console/debug output.
	 * @param logger - The logger implementation, `true` for DebugLogger, or `false` to disable
	 */
	logVia(logger: Logger | boolean): Agenda {
		if (this.jobProcessor) {
			throw new Error(
				'job processor is already running, you need to set logger before calling start'
			);
		}
		log('Agenda.logVia([Logger])');
		if (logger === true) {
			this.logger = new DebugLogger();
		} else if (logger === false) {
			this.logger = new NoopLogger();
		} else {
			this.logger = logger;
		}
		return this;
	}

	/**
	 * Check if a notification channel is configured
	 */
	hasNotificationChannel(): boolean {
		return !!this.notificationChannel;
	}

	/**
	 * Check if persistent job logging is enabled
	 */
	hasJobLogger(): boolean {
		return !!this.jobLogger;
	}

	/**
	 * Log a job lifecycle event to the persistent job logger (fire-and-forget).
	 * Does nothing if no job logger is configured or if the job definition
	 * has `logging: false`.
	 * @internal
	 */
	logJobEvent(entry: Omit<JobLogEntry, '_id' | 'timestamp' | 'agendaName'>): void {
		if (!this.jobLogger) return;

		// Check per-definition logging override
		const definition = this.definitions[entry.jobName];
		if (definition?.logging === false) return;

		this.jobLogger
			.log({
				...entry,
				timestamp: new Date(),
				agendaName: this.attrs.name || undefined
			})
			.catch(err => {
				log('failed to write job log entry: %O', err);
			});
	}

	/**
	 * Query persistent job logs.
	 * Returns empty result if no job logger is configured.
	 */
	async getLogs(query?: JobLogQuery): Promise<JobLogQueryResult> {
		if (!this.jobLogger) {
			return { entries: [], total: 0 };
		}
		return this.jobLogger.getLogs(query);
	}

	/**
	 * Clear persistent job logs matching the query.
	 * Returns 0 if no job logger is configured.
	 */
	async clearLogs(query?: JobLogQuery): Promise<number> {
		if (!this.jobLogger) {
			return 0;
		}
		return this.jobLogger.clearLogs(query);
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

		const notification: JobNotification = {
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
	 * Publish a job state notification to the notification channel.
	 * This enables bi-directional communication so that all subscribers
	 * can receive job lifecycle events (start, success, fail, complete, etc.)
	 * @internal
	 */
	publishJobStateNotification(
		job: Job,
		type: JobStateType,
		extra?: Partial<
			Omit<JobStateNotification, 'type' | 'jobId' | 'jobName' | 'timestamp' | 'source'>
		>
	): void {
		if (
			!this.notificationChannel ||
			this.notificationChannel.state !== 'connected' ||
			!this.notificationChannel.publishState
		) {
			// Channel not configured, not connected, or doesn't support state notifications
			return;
		}

		const notification: JobStateNotification = {
			type,
			jobId: job.attrs._id as JobId,
			jobName: job.attrs.name,
			timestamp: new Date(),
			source: this.attrs.name || undefined,
			...extra
		};

		// fire+forget
		this.notificationChannel
			.publishState(notification)
			.then(() => {
				log(
					'published job state notification [%s] for [%s:%s]',
					type,
					job.attrs.name,
					job.attrs._id
				);
			})
			.catch(error => {
				log(
					'failed to publish job state notification [%s] for [%s:%s]',
					type,
					job.attrs.name,
					job.attrs._id,
					error
				);
				this.emit('error', error);
			});
	}

	/**
	 * Subscribe to state notifications and re-emit them as regular events.
	 * This allows `agenda.on('success:jobName', ...)` to work across processes.
	 * @internal
	 */
	private subscribeToStateNotifications(): () => void {
		if (!this.notificationChannel?.subscribeState) {
			return () => {};
		}

		return this.notificationChannel.subscribeState(notification => {
			// Skip events from our own instance to avoid double-firing
			// (we already emit locally in Job.run())
			// Handle both empty strings and undefined as "same source" when both are falsy
			const notificationSource = notification.source || '';
			const ourSource = this.attrs.name || '';
			if (notificationSource === ourSource) {
				return;
			}

			log(
				'received remote state notification [%s] for [%s:%s]',
				notification.type,
				notification.jobName,
				notification.jobId
			);

			// Use nextTick to ensure local events are processed first
			// This prevents race conditions where remote events arrive before local processing completes
			process.nextTick(() => {
				// Re-emit as regular events with remote=true flag
				// For 'fail' events, the first argument is the error
				if (notification.type === 'fail') {
					this.emit('fail', notification.error, notification, true);
					this.emit(`fail:${notification.jobName}`, notification.error, notification, true);
				} else if (notification.type === 'retry') {
					// For 'retry' events, pass retry details as second argument
					const retryDetails: RetryDetails = {
						attempt: notification.retryAttempt || 1,
						delay: 0, // Not available in notification
						nextRunAt: notification.retryAt || new Date(),
						error: new Error(notification.error || 'Unknown error')
					};
					this.emit('retry', notification, retryDetails, true);
					this.emit(`retry:${notification.jobName}`, notification, retryDetails, true);
				} else {
					this.emit(notification.type, notification, true);
					this.emit(`${notification.type}:${notification.jobName}`, notification, true);
				}
			});
		});
	}

	/**
	 * Query jobs with database-agnostic options.
	 * Returns jobs with computed states and supports filtering by state.
	 *
	 * @param options - Query options (name, state, search, pagination)
	 * @returns Jobs with computed states and total count
	 */
	async queryJobs(options?: JobsQueryOptions): Promise<JobsResult> {
		await this.ready;
		return this.db.queryJobs(options);
	}

	/**
	 * Get overview statistics for jobs grouped by name.
	 * Returns counts of jobs in each state for each job name.
	 *
	 * @returns Array of job overviews with state counts
	 */
	async getJobsOverview(): Promise<JobsOverview[]> {
		await this.ready;
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
		options?: Partial<
			Pick<JobDefinition, 'lockLimit' | 'lockLifetime' | 'concurrency' | 'backoff' | 'removeOnComplete'>
		> & {
			priority?: JobPriority;
		}
	): void;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	define<DATA = any>(
		name: string,
		processor: (agendaJob: Job<DATA>) => Promise<void>,
		options?: Partial<
			Pick<JobDefinition, 'lockLimit' | 'lockLifetime' | 'concurrency' | 'backoff' | 'removeOnComplete'>
		> & {
			priority?: JobPriority;
		}
	): void;
	define(
		name: string,
		processor: ((job: Job) => Promise<void>) | ((job: Job, done: (err?: Error) => void) => void),
		options?: Partial<
			Pick<JobDefinition, 'lockLimit' | 'lockLifetime' | 'concurrency' | 'backoff' | 'removeOnComplete' | 'logging'>
		> & {
			priority?: JobPriority;
		}
	): void {
		if (this.definitions[name]) {
			log('overwriting already defined agenda job', name);
		}

		const filePath = getCallerFilePath();

		this.definitions[name] = {
			fn: processor as JobDefinition['fn'],
			filePath,
			concurrency: options?.concurrency || this.attrs.defaultConcurrency,
			lockLimit: options?.lockLimit || this.attrs.defaultLockLimit,
			priority: parsePriority(options?.priority),
			lockLifetime: options?.lockLifetime || this.attrs.defaultLockLifetime,
			backoff: options?.backoff,
			removeOnComplete: options?.removeOnComplete ?? this.attrs.removeOnComplete,
			logging: options?.logging
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
		options?: {
			timezone?: string;
			skipImmediate?: boolean;
			forkMode?: boolean;
			startDate?: Date | string;
			endDate?: Date | string;
			skipDays?: number[];
		}
	): Promise<Job<void>[]>;
	async every(
		interval: string | number,
		name: string,
		data?: undefined,
		options?: {
			timezone?: string;
			skipImmediate?: boolean;
			forkMode?: boolean;
			startDate?: Date | string;
			endDate?: Date | string;
			skipDays?: number[];
		}
	): Promise<Job<void>>;
	async every<DATA = unknown>(
		interval: string | number,
		names: string[],
		data: DATA,
		options?: {
			timezone?: string;
			skipImmediate?: boolean;
			forkMode?: boolean;
			startDate?: Date | string;
			endDate?: Date | string;
			skipDays?: number[];
		}
	): Promise<Job<DATA>[]>;
	async every<DATA = unknown>(
		interval: string | number,
		name: string,
		data: DATA,
		options?: {
			timezone?: string;
			skipImmediate?: boolean;
			forkMode?: boolean;
			startDate?: Date | string;
			endDate?: Date | string;
			skipDays?: number[];
		}
	): Promise<Job<DATA>>;
	async every(
		interval: string | number,
		names: string | string[],
		data?: unknown,
		options?: {
			timezone?: string;
			skipImmediate?: boolean;
			forkMode?: boolean;
			startDate?: Date | string;
			endDate?: Date | string;
			skipDays?: number[];
		}
	): // eslint-disable-next-line @typescript-eslint/no-explicit-any
	Promise<Job<any> | Job<any>[]> {
		log('Agenda.every(%s, %O, %O)', interval, names, options);

		/** Internal method to setup job that gets run every interval */
		const createJob = async (name: string): Promise<Job> => {
			const job = this.create(name, data);
			job.attrs.type = 'single';

			// Apply date constraints before repeatEvery (so they're used in nextRunAt computation)
			if (options?.startDate) {
				job.startDate(options.startDate);
			}
			if (options?.endDate) {
				job.endDate(options.endDate);
			}
			if (options?.skipDays) {
				job.skipDays(options.skipDays);
			}

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
	 * @param data
	 * @param options
	 */
	async schedule<DATA = void>(
		when: string | Date,
		names: string[],
		data?: undefined,
		options?: {
			startDate?: Date | string;
			endDate?: Date | string;
			skipDays?: number[];
		}
	): Promise<Job<DATA>[]>;
	async schedule<DATA = void>(
		when: string | Date,
		names: string,
		data?: undefined,
		options?: {
			startDate?: Date | string;
			endDate?: Date | string;
			skipDays?: number[];
		}
	): Promise<Job<DATA>>;
	async schedule<DATA = unknown>(
		when: string | Date,
		names: string[],
		data: DATA,
		options?: {
			startDate?: Date | string;
			endDate?: Date | string;
			skipDays?: number[];
		}
	): Promise<Job<DATA>[]>;
	async schedule<DATA = unknown>(
		when: string | Date,
		name: string,
		data: DATA,
		options?: {
			startDate?: Date | string;
			endDate?: Date | string;
			skipDays?: number[];
		}
	): Promise<Job<DATA>>;
	async schedule(
		when: string | Date,
		names: string | string[],
		data?: unknown,
		options?: {
			startDate?: Date | string;
			endDate?: Date | string;
			skipDays?: number[];
		}
	): Promise<Job | Job[]> {
		const createJob = async (name: string) => {
			const job = this.create(name, data);

			// Apply date constraints before scheduling
			if (options?.startDate) {
				job.startDate(options.startDate);
			}
			if (options?.endDate) {
				job.endDate(options.endDate);
			}
			if (options?.skipDays) {
				job.skipDays(options.skipDays);
			}

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
	 * Create a debounced job that combines rapid submissions into a single execution.
	 * Requires a unique key to identify which jobs should be debounced together.
	 *
	 * @param name - Job name
	 * @param data - Job data
	 * @param uniqueKey - Unique constraint to identify jobs (e.g., { 'data.userId': 123 })
	 * @param debounceMs - Debounce delay in milliseconds
	 * @param options - Optional debounce options (maxWait, strategy)
	 *
	 * @example
	 * ```ts
	 * // Debounce search index updates by entity type
	 * await agenda.nowDebounced(
	 *   'updateSearchIndex',
	 *   { entityType: 'products' },
	 *   { 'data.entityType': 'products' },
	 *   2000
	 * );
	 *
	 * // With maxWait to guarantee execution within 30s
	 * await agenda.nowDebounced(
	 *   'syncUser',
	 *   { userId: 123 },
	 *   { 'data.userId': 123 },
	 *   5000,
	 *   { maxWait: 30000 }
	 * );
	 * ```
	 */
	async nowDebounced<DATA = unknown>(
		name: string,
		data: DATA,
		uniqueKey: Record<string, unknown>,
		debounceMs: number,
		options?: { maxWait?: number; strategy?: 'trailing' | 'leading' }
	): Promise<Job<DATA>> {
		log('Agenda.nowDebounced(%s, [Object], %O, %d)', name, uniqueKey, debounceMs);
		try {
			const job = this.create(name, data);

			job.schedule(new Date()).unique(uniqueKey).debounce(debounceMs, options);

			await job.save();

			return job;
		} catch (error) {
			log('error trying to create a debounced job');
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

			// Subscribe to state notifications for cross-process event propagation
			this.stateSubscriptionUnsubscribe = this.subscribeToStateNotifications();
		}

		this.jobProcessor = new JobProcessor(
			this,
			this.attrs.maxConcurrency,
			this.attrs.lockLimit,
			this.attrs.processEvery,
			this.notificationChannel
		);

		this.logger.info(
			'Agenda started (processEvery=%dms, maxConcurrency=%d)',
			this.attrs.processEvery,
			this.attrs.maxConcurrency
		);
	}

	/**
	 * Clear the interval that processes the jobs and unlocks all currently locked jobs
	 * @param closeConnection - Whether to close the database connection.
	 *   Defaults to backend.ownsConnection (true if backend created the connection,
	 *   false if connection was passed in by user).
	 */
	async stop(closeConnection?: boolean): Promise<void> {
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

		// Unsubscribe from state notifications
		if (this.stateSubscriptionUnsubscribe) {
			this.stateSubscriptionUnsubscribe();
			this.stateSubscriptionUnsubscribe = undefined;
		}

		// Disconnect notification channel if configured (we always disconnect since we connected it in start)
		if (this.notificationChannel) {
			log('Agenda.stop disconnecting notification channel');
			await this.notificationChannel.disconnect();
		}

		// Determine whether to close backend connection
		const shouldClose = closeConnection ?? this.backend.ownsConnection ?? true;

		// Disconnect the backend
		if (shouldClose) {
			log('Agenda.stop disconnecting backend');
			await this.backend.disconnect();
		}

		this.jobProcessor = undefined;

		this.logger.info('Agenda stopped');
	}

	/**
	 * Waits for all currently running jobs to finish before stopping.
	 * This allows for a graceful shutdown where jobs complete their work.
	 * Unlike stop(), this method waits for running jobs to complete instead of unlocking them.
	 *
	 * @param options - Drain options or timeout in milliseconds
	 *   - `timeout`: Maximum time to wait for jobs to complete
	 *   - `signal`: AbortSignal to cancel the drain operation
	 *   - `closeConnection`: Whether to close the database connection (default: backend.ownsConnection)
	 * @returns DrainResult with completion statistics
	 *
	 * @example
	 * // Wait indefinitely for all jobs to complete
	 * await agenda.drain();
	 *
	 * @example
	 * // Wait up to 30 seconds
	 * const result = await agenda.drain(30000);
	 * if (result.timedOut) console.log(`${result.running} jobs still running`);
	 *
	 * @example
	 * // Use AbortSignal for external control
	 * const controller = new AbortController();
	 * setTimeout(() => controller.abort(), 30000);
	 * await agenda.drain({ signal: controller.signal });
	 */
	async drain(
		options?: number | (DrainOptions & { closeConnection?: boolean })
	): Promise<DrainResult> {
		if (!this.jobProcessor) {
			log('Agenda.drain called, but agenda has never started!');
			return { completed: 0, running: 0, timedOut: false, aborted: false };
		}

		// Normalize options
		const opts =
			typeof options === 'number' ? { timeout: options } : options ?? {};

		log('Agenda.drain called, waiting for jobs to finish');

		const result = await this.jobProcessor.drain(opts);

		// Unsubscribe from state notifications
		if (this.stateSubscriptionUnsubscribe) {
			this.stateSubscriptionUnsubscribe();
			this.stateSubscriptionUnsubscribe = undefined;
		}

		// Disconnect notification channel if configured (we always disconnect since we connected it in start)
		if (this.notificationChannel) {
			log('Agenda.drain disconnecting notification channel');
			await this.notificationChannel.disconnect();
		}

		// Determine whether to close backend connection
		const shouldClose = opts.closeConnection ?? this.backend.ownsConnection ?? true;

		// Disconnect the backend
		if (shouldClose) {
			log('Agenda.drain disconnecting backend');
			await this.backend.disconnect();
		}

		this.jobProcessor = undefined;

		this.logger.info(
			'Agenda drained (completed=%d, running=%d, timedOut=%s)',
			result.completed,
			result.running,
			result.timedOut
		);

		return result;
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

export * from './types/AgendaStatus.js';

export * from './types/DrainOptions.js';

export * from './notifications/index.js';

export * from './types/Logger.js';

export * from './types/JobLogger.js';

export * from './logging/index.js';

export {
	applyAllDateConstraints,
	applyDateRangeConstraints,
	applySkipDays,
	shouldSkipDay,
	isWithinDateRange
} from './utils/dateConstraints.js';

export * from './decorators/index.js';

export {
	backoffStrategies,
	constant,
	linear,
	exponential,
	combine,
	when,
	type BackoffStrategy,
	type BackoffContext,
	type BackoffOptions,
	type ExponentialBackoffOptions,
	type LinearBackoffOptions
} from './utils/backoff.js';
