import date from 'date.js';
import debug from 'debug';
import { ChildProcess, fork } from 'child_process';
import type { Agenda } from './index.js';
import type { DefinitionProcessor } from './types/JobDefinition.js';
import { JobParameters, datefields, TJobDatefield, JobId } from './types/JobParameters.js';
import { JobPriority, parsePriority } from './utils/priority.js';
import { computeFromInterval, computeFromRepeatAt } from './utils/nextRunAt.js';
import { applyAllDateConstraints } from './utils/dateConstraints.js';
import type { BackoffContext } from './utils/backoff.js';

const log = debug('agenda:job');

/**
 * @class
 */
export class Job<DATA = unknown | void> {
	readonly attrs: JobParameters<DATA>;

	/** this flag is set to true, if a job got canceled (e.g. due to a timeout or other exception),
	 * you can use it for long running tasks to periodically check if canceled is true,
	 * also touch will check if and throws that the job got canceled
	 */
	private canceled?: Error | true;

	getCanceledMessage() {
		return typeof this.canceled === 'object'
			? this.canceled?.message || this.canceled
			: this.canceled;
	}

	private forkedChild?: ChildProcess;

	/**
	 * Internal storage for nextRunAt value
	 */
	private _nextRunAt: Date | null | undefined;

	/**
	 * Flag to track if nextRunAt was explicitly set by user code.
	 * When true, save() won't overwrite nextRunAt from DB result to avoid race conditions.
	 */
	private _nextRunAtExplicitlySet = false;

	cancel(error?: Error) {
		this.canceled = error || true;
		if (this.forkedChild) {
			try {
				this.forkedChild.send('cancel');
				log('canceled child', this.attrs.name, this.attrs._id);
			} catch {
				log('cannot send cancel to child');
			}
		}
	}

	/** internal variable to ensure a job does not set unlimited numbers of setTimeouts if the job is not processed
	 * immediately */
	gotTimerToExecute!: boolean;

	/**
	 * creates a new job object
	 * @param agenda
	 * @param args
	 * @param byJobProcessor
	 */
	constructor(
		agenda: Agenda,
		args: Partial<JobParameters<void>> & {
			name: string;
			type: 'normal' | 'single';
		},
		byJobProcessor?: boolean
	);
	constructor(
		agenda: Agenda,
		args: Partial<JobParameters<DATA>> & {
			name: string;
			type: 'normal' | 'single';
			data: DATA;
		},
		byJobProcessor?: boolean
	);
	constructor(
		readonly agenda: Agenda,
		args: Partial<JobParameters<DATA>> & {
			name: string;
			type: 'normal' | 'single';
			data: DATA;
		},
		private readonly byJobProcessor = false
	) {
		// Initialize internal nextRunAt storage
		this._nextRunAt = args.nextRunAt === undefined ? new Date() : args.nextRunAt;

		// Create attrs object without nextRunAt first (nextRunAt handled via getter/setter)
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { nextRunAt: _unusedNextRunAt, ...restArgs } = args;
		const attrsBase = {
			...restArgs,
			// Set defaults if undefined
			priority: parsePriority(args.priority),
			type: args.type
		};

		// Set attrs and define getter/setter for nextRunAt to track explicit modifications
		this.attrs = attrsBase as JobParameters<DATA>;
		Object.defineProperty(this.attrs, 'nextRunAt', {
			get: () => this._nextRunAt,
			set: (value: Date | null | undefined) => {
				this._nextRunAt = value;
				this._nextRunAtExplicitlySet = true;
			},
			enumerable: true,
			configurable: true
		});
	}

	/**
	 * Fields managed by the job processor that should not be overwritten
	 * when user code explicitly sets nextRunAt (e.g., via schedule()).
	 */
	private static readonly PROCESSOR_MANAGED_FIELDS = new Set([
		'lockedAt',
		'lastRunAt',
		'lastFinishedAt',
		'failedAt',
		'failCount',
		'failReason',
		'progress'
	]);

	/**
	 * Given a job, turn it into an JobParameters object
	 * @param excludeProcessorFields - If true, excludes fields managed by the job processor
	 */
	toJson(excludeProcessorFields = false): JobParameters {
		const result = {} as JobParameters;
		const attrs = this.attrs as unknown as Record<string, unknown>;

		for (const key of Object.keys(attrs)) {
			if (Object.hasOwnProperty.call(attrs, key)) {
				// Skip processor-managed fields if requested
				if (excludeProcessorFields && Job.PROCESSOR_MANAGED_FIELDS.has(key)) {
					continue;
				}
				(result as unknown as Record<string, unknown>)[key] =
					datefields.includes(key as TJobDatefield) && attrs[key]
						? new Date(attrs[key] as string | number | Date)
						: attrs[key];
			}
		}

		return result;
	}

	/**
	 * Sets a job to repeat every X amount of time
	 * @param interval
	 * @param options
	 */
	repeatEvery(
		interval: string | number,
		options: { timezone?: string; skipImmediate?: boolean } = {}
	): this {
		this.attrs.repeatInterval = interval;
		this.attrs.repeatTimezone = options.timezone;
		if (options.skipImmediate) {
			// Set the lastRunAt time to the nextRunAt so that the new nextRunAt will be computed in reference to the current value.
			this.attrs.lastRunAt = this.attrs.nextRunAt || new Date();
			this.computeNextRunAt();
			this.attrs.lastRunAt = undefined;
		} else {
			this.computeNextRunAt();
		}

		return this;
	}

	/**
	 * Sets a job to repeat at a specific time
	 * @param time
	 */
	repeatAt(time: string): this {
		this.attrs.repeatAt = time;
		return this;
	}

	/**
	 * Sets the start date for the job.
	 * The job will not run before this date.
	 * @param date - The start date (Date object or string parseable by Date constructor)
	 */
	startDate(dateInput: Date | string): this {
		const d = new Date(dateInput);
		if (Number.isNaN(d.getTime())) {
			throw new Error(`Invalid start date: ${dateInput}`);
		}
		this.attrs.startDate = d;
		return this;
	}

	/**
	 * Sets the end date for the job.
	 * The job will not run after this date (nextRunAt will be set to null).
	 * @param date - The end date (Date object or string parseable by Date constructor)
	 */
	endDate(dateInput: Date | string): this {
		const d = new Date(dateInput);
		if (Number.isNaN(d.getTime())) {
			throw new Error(`Invalid end date: ${dateInput}`);
		}
		this.attrs.endDate = d;
		return this;
	}

	/**
	 * Sets the days of the week to skip.
	 * The job will not run on these days.
	 * @param days - Array of days to skip (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
	 */
	skipDays(days: number[]): this {
		// Validate days
		for (const day of days) {
			if (day < 0 || day > 6 || !Number.isInteger(day)) {
				throw new Error(`Invalid skip day: ${day}. Must be an integer 0-6 (0=Sunday, 6=Saturday)`);
			}
		}
		this.attrs.skipDays = [...new Set(days)]; // Remove duplicates
		return this;
	}

	/**
	 * if set, a job is forked via node child process and runs in a seperate/own
	 * thread
	 * @param enableForkMode
	 */
	forkMode(enableForkMode: boolean): this {
		this.attrs.fork = enableForkMode;
		return this;
	}

	/**
	 * Prevents the job from running
	 */
	disable(): this {
		this.attrs.disabled = true;
		return this;
	}

	/**
	 * Allows job to run
	 */
	enable(): this {
		this.attrs.disabled = false;
		return this;
	}

	/**
	 * Data to ensure is unique for job to be created
	 * @param unique
	 * @param opts
	 */
	unique(
		unique: Required<JobParameters<DATA>>['unique'],
		opts?: JobParameters['uniqueOpts']
	): this {
		this.attrs.unique = unique;
		this.attrs.uniqueOpts = opts;
		return this;
	}

	/**
	 * Schedules a job to run at specified time.
	 * Date constraints (startDate, endDate, skipDays) are applied if set.
	 * @param time
	 */
	schedule(time: string | Date): this {
		const d = new Date(time);

		let nextRunAt: Date | null = Number.isNaN(d.getTime()) ? date(time as string) : d;

		// Apply date constraints if any are set
		if (this.attrs.startDate || this.attrs.endDate || this.attrs.skipDays) {
			nextRunAt = applyAllDateConstraints(nextRunAt, {
				startDate: this.attrs.startDate,
				endDate: this.attrs.endDate,
				skipDays: this.attrs.skipDays,
				timezone: this.attrs.repeatTimezone
			});
		}

		this.attrs.nextRunAt = nextRunAt;

		return this;
	}

	/**
	 * Sets priority of the job
	 * @param priority priority of when job should be queued
	 */
	priority(priority: JobPriority): this {
		this.attrs.priority = parsePriority(priority);
		return this;
	}

	/**
	 * Fails the job with a reason (error) specified
	 *
	 * @param reason
	 */
	fail(reason: Error | string): this {
		this.attrs.failReason = reason instanceof Error ? reason.message : reason;
		this.attrs.failCount = (this.attrs.failCount || 0) + 1;
		const now = new Date();
		this.attrs.failedAt = now;
		this.attrs.lastFinishedAt = now;
		log(
			'[%s:%s] fail() called [%d] times so far',
			this.attrs.name,
			this.attrs._id,
			this.attrs.failCount
		);
		return this;
	}

	private async fetchStatus(): Promise<void> {
		const result = await this.agenda.db.queryJobs({ id: this.attrs._id?.toString() });
		if (!result.jobs || result.jobs.length === 0) {
			// @todo: should we just return false instead? a finished job could have been removed from database,
			// and then this would throw...
			throw new Error(`job with id ${this.attrs._id} not found in database`);
		}

		this.attrs.lastRunAt = result.jobs[0].lastRunAt;
		this.attrs.lockedAt = result.jobs[0].lockedAt;
		this.attrs.lastFinishedAt = result.jobs[0].lastFinishedAt;
	}

	/**
	 * A job is running if:
	 * (lastRunAt exists AND lastFinishedAt does not exist)
	 * OR
	 * (lastRunAt exists AND lastFinishedAt exists but the lastRunAt is newer [in time] than lastFinishedAt)
	 * @returns Whether or not job is running at the moment (true for running)
	 */
	async isRunning(): Promise<boolean> {
		if (!this.byJobProcessor || this.attrs.fork) {
			// we have no job definition, therfore we are not the job processor, but a client call
			// so we get the real state from database
			await this.fetchStatus();
		}

		if (!this.attrs.lastRunAt) {
			return false;
		}

		if (!this.attrs.lastFinishedAt) {
			return true;
		}

		if (
			this.attrs.lockedAt &&
			this.attrs.lastRunAt.getTime() > this.attrs.lastFinishedAt.getTime()
		) {
			return true;
		}

		return false;
	}

	/**
	 * Saves a job to database
	 */
	async save(): Promise<Job> {
		if (this.agenda.forkedWorker) {
			const warning = new Error('calling save() on a Job during a forkedWorker has no effect!');
			log('WARNING: %s %s', warning.message, warning.stack);
			return this as Job;
		}
		// ensure db connection is ready
		await this.agenda.ready;

		// Capture whether nextRunAt was explicitly set before we potentially overwrite it
		const wasNextRunAtExplicitlySet = this._nextRunAtExplicitlySet;
		this._nextRunAtExplicitlySet = false;

		// When nextRunAt was explicitly set (e.g., via schedule()), only save user fields,
		// not processor-managed fields like lockedAt, failCount, etc.
		// This prevents race conditions when save() is called without awaiting.
		const result = await this.agenda.db.saveJob(this.toJson(wasNextRunAtExplicitlySet), {
			lastModifiedBy: this.agenda.attrs.name || undefined
		});
		// Update attrs from result
		this.attrs._id = result._id;
		this._nextRunAt = result.nextRunAt;

		// Publish notification for real-time processing if channel is configured
		if (this.agenda.hasNotificationChannel()) {
			await this.agenda.publishJobNotification(this);
		}

		return this as Job;
	}

	/**
	 * Remove the job from database
	 */
	remove(): Promise<number> {
		return this.agenda.cancel({ id: this.attrs._id });
	}

	async isDead(): Promise<boolean> {
		return this.isExpired();
	}

	async isExpired(): Promise<boolean> {
		if (!this.byJobProcessor || this.attrs.fork) {
			// we have no job definition, therfore we are not the job processor, but a client call
			// so we get the real state from database
			await this.fetchStatus();
		}

		const definition = this.agenda.definitions[this.attrs.name];

		const lockDeadline = new Date(Date.now() - definition.lockLifetime);

		// This means a job has "expired", as in it has not been "touched" within the lockoutTime
		// Remove from local lock
		if (this.attrs.lockedAt && this.attrs.lockedAt < lockDeadline) {
			return true;
		}
		return false;
	}

	/**
	 * Updates "lockedAt" time so the job does not get picked up again
	 * @param progress 0 to 100
	 */
	async touch(progress?: number): Promise<void> {
		if (this.canceled) {
			throw new Error(`job ${this.attrs.name} got canceled already: ${this.canceled}!`);
		}
		this.attrs.lockedAt = new Date();
		this.attrs.progress = progress;

		await this.agenda.db.saveJobState(this.attrs, {
			lastModifiedBy: this.agenda.attrs.name || undefined
		});
	}

	private computeNextRunAt() {
		try {
			if (this.attrs.repeatInterval) {
				const nextRunAt = computeFromInterval(this.attrs);
				this._nextRunAt = nextRunAt;
				if (nextRunAt) {
					log(
						'[%s:%s] nextRunAt set to [%s]',
						this.attrs.name,
						this.attrs._id,
						nextRunAt.toISOString()
					);
				} else {
					log(
						'[%s:%s] nextRunAt set to null (date constraints)',
						this.attrs.name,
						this.attrs._id
					);
				}
			} else if (this.attrs.repeatAt) {
				const nextRunAt = computeFromRepeatAt(this.attrs);
				this._nextRunAt = nextRunAt;

				if (nextRunAt) {
					log(
						'[%s:%s] nextRunAt set to [%s]',
						this.attrs.name,
						this.attrs._id,
						nextRunAt.toISOString()
					);
				} else {
					log(
						'[%s:%s] nextRunAt set to null (date constraints)',
						this.attrs.name,
						this.attrs._id
					);
				}
			} else {
				this._nextRunAt = null;
			}
		} catch (error) {
			this._nextRunAt = null;
			this.fail(error as Error);
		}

		return this;
	}

	/**
	 * Handle automatic retry with backoff strategy
	 * @param error - The error that caused the failure
	 */
	private async handleRetry(error: Error): Promise<void> {
		const definition = this.agenda.definitions[this.attrs.name];

		// No backoff strategy configured - skip auto-retry
		if (!definition?.backoff) {
			return;
		}

		const context: BackoffContext = {
			attempt: this.attrs.failCount || 1,
			error,
			jobName: this.attrs.name,
			jobData: this.attrs.data
		};

		const retryDelay = definition.backoff(context);

		if (retryDelay === null) {
			// No more retries - emit exhausted event
			log(
				'[%s:%s] retry attempts exhausted after %d failures',
				this.attrs.name,
				this.attrs._id,
				this.attrs.failCount
			);
			this.agenda.emit('retry exhausted', error, this);
			this.agenda.emit(`retry exhausted:${this.attrs.name}`, error, this);
			return;
		}

		// Schedule retry (use internal setter to not mark as user-explicit)
		const nextRunAt = new Date(Date.now() + retryDelay);
		this._nextRunAt = nextRunAt;

		log(
			'[%s:%s] scheduling retry #%d in %dms (at %s)',
			this.attrs.name,
			this.attrs._id,
			this.attrs.failCount,
			retryDelay,
			nextRunAt.toISOString()
		);

		this.agenda.emit('retry', this, {
			attempt: this.attrs.failCount!,
			delay: retryDelay,
			nextRunAt,
			error
		});
		this.agenda.emit(`retry:${this.attrs.name}`, this, {
			attempt: this.attrs.failCount!,
			delay: retryDelay,
			nextRunAt,
			error
		});
	}

	async run(): Promise<void> {
		this.attrs.lastRunAt = new Date();
		log(
			'[%s:%s] setting lastRunAt to: %s',
			this.attrs.name,
			this.attrs._id,
			this.attrs.lastRunAt.toISOString()
		);
		this.computeNextRunAt();
		await this.agenda.db.saveJobState(this.attrs, {
			lastModifiedBy: this.agenda.attrs.name || undefined
		});

		try {
			this.agenda.emit('start', this);
			this.agenda.emit(`start:${this.attrs.name}`, this);
			log('[%s:%s] starting job', this.attrs.name, this.attrs._id);

			if (this.attrs.fork) {
				if (!this.agenda.forkHelper) {
					throw new Error('no forkHelper specified, you need to set a path to a helper script');
				}
				const { forkHelper } = this.agenda;

				await new Promise<void>((resolve, reject) => {
					this.forkedChild = fork(
						forkHelper.path,
						[
							this.attrs.name,
							this.attrs._id!.toString(),
							this.agenda.definitions[this.attrs.name].filePath || ''
						],
						forkHelper.options
					);

					let childError: unknown;
					this.forkedChild.on('close', code => {
						if (code) {
							log(
								'fork parameters: %O name=%s id=%s filePath=%s',
								forkHelper,
								this.attrs.name,
								this.attrs._id,
								this.agenda.definitions[this.attrs.name].filePath
							);
							const error = new Error(`child process exited with code: ${code}`);
							log('fork child error: %s %O', error.message, childError || this.canceled);
							reject(childError || this.canceled || error);
						} else {
							resolve();
						}
					});
					this.forkedChild.on('message', message => {
						// console.log(`Message from child.js: ${message}`, JSON.stringify(message));
						if (typeof message === 'string') {
							try {
								childError = JSON.parse(message);
							} catch {
								childError = message;
							}
						} else {
							childError = message;
						}
					});
				});
			} else {
				await this.runJob();
			}

			this.attrs.lastFinishedAt = new Date();

			this.agenda.emit('success', this);
			this.agenda.emit(`success:${this.attrs.name}`, this);
			log('[%s:%s] has succeeded', this.attrs.name, this.attrs._id);
		} catch (error) {
			log('[%s:%s] unknown error occurred', this.attrs.name, this.attrs._id);

			this.fail(error as Error);

			this.agenda.emit('fail', error, this);
			this.agenda.emit(`fail:${this.attrs.name}`, error, this);
			log('[%s:%s] has failed [%s]', this.attrs.name, this.attrs._id, (error as Error).message);

			// Handle automatic retry with backoff strategy
			await this.handleRetry(error as Error);
		} finally {
			this.forkedChild = undefined;
			this.attrs.lockedAt = undefined;
			try {
				await this.agenda.db.saveJobState(this.attrs, {
					lastModifiedBy: this.agenda.attrs.name || undefined
				});
				log('[%s:%s] was saved successfully to database', this.attrs.name, this.attrs._id);
			} catch (err) {
				// in case this fails, we ignore it
				// this can e.g. happen if the job gets removed during the execution
				log('[%s:%s] was not saved to database', this.attrs.name, this.attrs._id, err);
			}

			this.agenda.emit('complete', this);
			this.agenda.emit(`complete:${this.attrs.name}`, this);
			log(
				'[%s:%s] job finished at [%s] and was unlocked',
				this.attrs.name,
				this.attrs._id,
				this.attrs.lastFinishedAt
			);
		}
	}

	async runJob() {
		const definition = this.agenda.definitions[this.attrs.name];

		if (!definition) {
			log('[%s:%s] has no definition, can not run', this.attrs.name, this.attrs._id);
			throw new Error('Undefined job');
		}

		if (definition.fn.length === 2) {
			log('[%s:%s] process function being called', this.attrs.name, this.attrs._id);
			await new Promise<void>((resolve, reject) => {
				try {
					const result = definition.fn(this as Job, error => {
						if (error) {
							reject(error);
							return;
						}
						resolve();
					});

					if (this.isPromise(result)) {
						result.catch((error: Error) => reject(error));
					}
				} catch (error) {
					reject(error);
				}
			});
		} else {
			log('[%s:%s] process function being called', this.attrs.name, this.attrs._id);
			await (definition.fn as DefinitionProcessor<DATA, void>)(this);
		}
	}

	private isPromise(value: unknown): value is Promise<void> {
		return !!(value && typeof (value as Promise<void>).then === 'function');
	}
}

export type JobWithId = Job & { attrs: JobParameters & { _id: JobId } };
