import * as date from 'date.js';
import * as debug from 'debug';
import { ObjectId } from 'mongodb';
import type { Agenda } from './index';
import type { DefinitionProcessor } from './types/JobDefinition';
import { IJobParameters, datefields, TJobDatefield } from './types/JobParameters';
import { JobPriority, parsePriority } from './utils/priority';
import { computeFromInterval, computeFromRepeatAt } from './utils/nextRunAt';

const log = debug('agenda:job');

/**
 * @class
 */
export class Job<DATA = unknown | void> {
	readonly attrs: IJobParameters<DATA>;

	/** this flag is set to true, if a job got canceled (e.g. due to a timeout or other exception),
	 * you can use it for long running tasks to periodically check if canceled is true,
	 * also touch will check if and throws that the job got canceled
	 */
	canceled: Error | undefined;

	/** internal variable to ensure a job does not set unlimited numbers of setTimeouts if the job is not processed
	 * immediately */
	gotTimerToExecute: boolean;

	/**
	 * creates a new job object
	 * @param agenda
	 * @param args
	 * @param byJobProcessor
	 */
	constructor(
		agenda: Agenda,
		args: Partial<IJobParameters<void>> & {
			name: string;
			type: 'normal' | 'single';
		},
		byJobProcessor?: boolean
	);
	constructor(
		agenda: Agenda,
		args: Partial<IJobParameters<DATA>> & {
			name: string;
			type: 'normal' | 'single';
			data: DATA;
		},
		byJobProcessor?: boolean
	);
	constructor(
		readonly agenda: Agenda,
		args: Partial<IJobParameters<DATA>> & {
			name: string;
			type: 'normal' | 'single';
			data: DATA;
		},
		private readonly byJobProcessor = false
	) {
		// Set attrs to args
		this.attrs = {
			...args,
			// Set defaults if undefined
			priority: parsePriority(args.priority),
			nextRunAt: args.nextRunAt === undefined ? new Date() : args.nextRunAt,
			type: args.type
		};
	}

	/**
	 * Given a job, turn it into an JobParameters object
	 */
	toJson(): IJobParameters {
		const result = {} as IJobParameters;

		for (const key of Object.keys(this.attrs)) {
			if (Object.hasOwnProperty.call(this.attrs, key)) {
				result[key] =
					datefields.includes(key as TJobDatefield) && this.attrs[key]
						? new Date(this.attrs[key])
						: this.attrs[key];
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
		unique: Required<IJobParameters<DATA>>['unique'],
		opts?: IJobParameters['uniqueOpts']
	): this {
		this.attrs.unique = unique;
		this.attrs.uniqueOpts = opts;
		return this;
	}

	/**
	 * Schedules a job to run at specified time
	 * @param time
	 */
	schedule(time: string | Date): this {
		const d = new Date(time);

		this.attrs.nextRunAt = Number.isNaN(d.getTime()) ? date(time) : d;

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
		const dbJob = await this.agenda.db.getJobs({ _id: this.attrs._id });
		if (!dbJob || dbJob.length === 0) {
			// @todo: should we just return false instead? a finished job could have been removed from database,
			// and then this would throw...
			throw new Error(`job with id ${this.attrs._id} not found in database`);
		}

		this.attrs.lastRunAt = dbJob[0].lastRunAt;
		this.attrs.lockedAt = dbJob[0].lockedAt;
		this.attrs.lastFinishedAt = dbJob[0].lastFinishedAt;
	}

	/**
	 * A job is running if:
	 * (lastRunAt exists AND lastFinishedAt does not exist)
	 * OR
	 * (lastRunAt exists AND lastFinishedAt exists but the lastRunAt is newer [in time] than lastFinishedAt)
	 * @returns Whether or not job is running at the moment (true for running)
	 */
	async isRunning(): Promise<boolean> {
		if (!this.byJobProcessor) {
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
		// ensure db connection is ready
		await this.agenda.ready;
		return this.agenda.db.saveJob(this as Job);
	}

	/**
	 * Remove the job from database
	 */
	remove(): Promise<number> {
		return this.agenda.cancel({ _id: this.attrs._id });
	}

	async isDead(): Promise<boolean> {
		if (!this.byJobProcessor) {
			// we have no job definition, therfore we are not the job processor, but a client call
			// so we get the real state from database
			await this.fetchStatus();
		}

		return this.isExpired();
	}

	isExpired(): boolean {
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

		await this.agenda.db.saveJobState(this);
	}

	private computeNextRunAt() {
		try {
			if (this.attrs.repeatInterval) {
				this.attrs.nextRunAt = computeFromInterval(this.attrs);
				log(
					'[%s:%s] nextRunAt set to [%s]',
					this.attrs.name,
					this.attrs._id,
					new Date(this.attrs.nextRunAt).toISOString()
				);
			} else if (this.attrs.repeatAt) {
				this.attrs.nextRunAt = computeFromRepeatAt(this.attrs);

				log(
					'[%s:%s] nextRunAt set to [%s]',
					this.attrs.name,
					this.attrs._id,
					this.attrs.nextRunAt.toISOString()
				);
			} else {
				this.attrs.nextRunAt = null;
			}
		} catch (error: any) {
			this.attrs.nextRunAt = null;
			this.fail(error);
		}

		return this;
	}

	async run(): Promise<void> {
		const definition = this.agenda.definitions[this.attrs.name];

		this.attrs.lastRunAt = new Date();
		log(
			'[%s:%s] setting lastRunAt to: %s',
			this.attrs.name,
			this.attrs._id,
			this.attrs.lastRunAt.toISOString()
		);
		this.computeNextRunAt();
		await this.agenda.db.saveJobState(this);

		try {
			this.agenda.emit('start', this);
			this.agenda.emit(`start:${this.attrs.name}`, this);
			log('[%s:%s] starting job', this.attrs.name, this.attrs._id);
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

			this.attrs.lastFinishedAt = new Date();

			this.agenda.emit('success', this);
			this.agenda.emit(`success:${this.attrs.name}`, this);
			log('[%s:%s] has succeeded', this.attrs.name, this.attrs._id);
		} catch (error: any) {
			log('[%s:%s] unknown error occurred', this.attrs.name, this.attrs._id);

			this.fail(error);

			this.agenda.emit('fail', error, this);
			this.agenda.emit(`fail:${this.attrs.name}`, error, this);
			log('[%s:%s] has failed [%s]', this.attrs.name, this.attrs._id, error.message);
		} finally {
			this.attrs.lockedAt = undefined;
			await this.agenda.db.saveJobState(this);
			log('[%s:%s] was saved successfully to MongoDB', this.attrs.name, this.attrs._id);

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

	private isPromise(value: unknown): value is Promise<void> {
		return !!(value && typeof (value as Promise<void>).then === 'function');
	}
}

export type JobWithId = Job & { attrs: IJobParameters & { _id: ObjectId } };
