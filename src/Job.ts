import * as date from 'date.js';
import * as debug from 'debug';
import { ObjectId } from 'mongodb';
import type { Agenda } from './index';
import type { IJobParameters } from './types/JobParameters';
import type { DefinitionProcessor } from './types/JobDefinition';
import { JobPriority, parsePriority } from './utils/priority';
import { computeFromInterval, computeFromRepeatAt } from './utils/nextRunAt';

const log = debug('agenda:job');

/**
 * @class
 * @param {Object} args - Job Options
 * @property {Object} agenda - The Agenda instance
 * @property {Object} attrs
 */
export class Job<DATA = unknown | void> {
	readonly attrs: IJobParameters<DATA>;

	/** this flag is set to true, if a job got canceled (e.g. due to a timeout or other exception),
	 * you can use it for long running tasks to periodically check if canceled is true,
	 * also touch will check if and throws that the job got canceled
	 */
	canceled: Error | undefined;

	constructor(
		agenda: Agenda,
		args: Partial<IJobParameters<void>> & {
			name: string;
			type: 'normal' | 'single';
		}
	);
	constructor(
		agenda: Agenda,
		args: Partial<IJobParameters<DATA>> & {
			name: string;
			type: 'normal' | 'single';
			data: DATA;
		}
	);
	constructor(
		readonly agenda: Agenda,
		args: Partial<IJobParameters<DATA>> & {
			name: string;
			type: 'normal' | 'single';
			data: DATA;
		}
	) {
		// Set attrs to args
		this.attrs = {
			...args,
			// Set defaults if undefined
			priority: parsePriority(args.priority),
			nextRunAt: args.nextRunAt || new Date(),
			type: args.type
		};
	}

	toJson(): IJobParameters {
		const attrs = this.attrs || {};
		const result = {};

		// eslint-disable-next-line no-restricted-syntax
		for (const prop in attrs) {
			if ({}.hasOwnProperty.call(attrs, prop)) {
				result[prop] = attrs[prop];
			}
		}

		const dates = ['lastRunAt', 'lastFinishedAt', 'nextRunAt', 'failedAt', 'lockedAt'];
		dates.forEach(d => {
			if (result[d]) {
				result[d] = new Date(result[d]);
			}
		});

		return result as IJobParameters;
	}

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

	repeatAt(time: string): this {
		this.attrs.repeatAt = time;
		return this;
	}

	disable(): this {
		this.attrs.disabled = true;
		return this;
	}

	enable(): this {
		this.attrs.disabled = false;
		return this;
	}

	unique(
		unique: Required<IJobParameters<DATA>>['unique'],
		opts?: IJobParameters['uniqueOpts']
	): this {
		this.attrs.unique = unique;
		this.attrs.uniqueOpts = opts;
		return this;
	}

	schedule(time: string | Date): this {
		const d = new Date(time);

		this.attrs.nextRunAt = Number.isNaN(d.getTime()) ? date(time) : d;

		return this;
	}

	/**
	 * Sets priority of the job
	 * @param {String} priority priority of when job should be queued
	 * @returns {exports} instance of Job
	 */
	priority(priority: JobPriority): this {
		this.attrs.priority = parsePriority(priority);
		return this;
	}

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

	async isRunning(): Promise<boolean> {
		const definition = this.agenda.definitions[this.attrs.name];
		if (!definition) {
			// we have no job definition, therfore we are not the job processor, but a client call
			// so we get the real state from database
			const dbJob = await this.agenda.db.getJobs({ _id: this.attrs._id });
			this.attrs.lastRunAt = dbJob[0].lastRunAt;
			this.attrs.lastFinishedAt = dbJob[0].lastFinishedAt;
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

	async save(): Promise<Job> {
		// ensure db connection is ready
		await this.agenda.ready;
		return this.agenda.db.saveJob(this);
	}

	remove(): Promise<number> {
		return this.agenda.cancel({ _id: this.attrs._id });
	}

	isDead(): boolean {
		const definition = this.agenda.definitions[this.attrs.name];
		if (!definition) {
			console.warn('this method is only callable from an agenda job processor');
			return false;
		}
		const lockDeadline = new Date(Date.now() - definition.lockLifetime);

		// This means a job has "expired", as in it has not been "touched" within the lockoutTime
		// Remove from local lock
		if (this.attrs.lockedAt && this.attrs.lockedAt < lockDeadline) {
			return true;
		}
		return false;
	}

	async touch(progress?: number): Promise<void> {
		if (this.canceled) {
			throw new Error(`job ${this.attrs.name} got canceled already: ${this.canceled}!`);
		}
		this.attrs.lockedAt = new Date();
		this.attrs.progress = progress;
		await this.save();
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
		} catch (error) {
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
		await this.save();

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
				await new Promise((resolve, reject) => {
					try {
						const result = definition.fn(this, error => {
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
		} catch (error) {
			log('[%s:%s] unknown error occurred', this.attrs.name, this.attrs._id);

			this.fail(error);

			this.agenda.emit('fail', error, this);
			this.agenda.emit(`fail:${this.attrs.name}`, error, this);
			log('[%s:%s] has failed [%s]', this.attrs.name, this.attrs._id, error.message);
		} finally {
			this.attrs.lockedAt = undefined;
			await this.save();
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
