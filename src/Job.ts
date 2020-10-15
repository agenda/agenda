import * as date from 'date.js';
import * as debug from 'debug';
import { parsePriority } from './utils/priority';
import type { Agenda } from './index';
import { computeFromInterval, computeFromRepeatAt } from './utils/nextRunAt';
import { IJobParameters } from './types/JobParameters';
import type { DefinitionProcessor } from './types/JobDefinition';

const log = debug('agenda:job');

/**
 * @class
 * @param {Object} args - Job Options
 * @property {Object} agenda - The Agenda instance
 * @property {Object} attrs
 */
export class Job<DATA = any | void> {
	readonly attrs: IJobParameters<DATA>;

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
			data: any;
		}
	) {
		// Remove special args

		// Process args
		args.priority = parsePriority(args.priority) || 0;

		// Set attrs to args
		this.attrs = {
			...args,
			// Set defaults if undefined
			priority: args.priority || 0,
			nextRunAt: args.nextRunAt || new Date(),
			type: args.type // || 'once'
		};
	}

	toJson(): Partial<IJobParameters> {
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

		// console.log('toJson', this.attrs, result);
		return result;
	}

	repeatEvery(
		interval: string | number,
		options: { timezone?: string; skipImmediate?: boolean } = {}
	) {
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

	repeatAt(time) {
		this.attrs.repeatAt = time;
		return this;
	}

	disable() {
		this.attrs.disabled = true;
		return this;
	}

	enable() {
		this.attrs.disabled = false;
		return this;
	}

	unique(unique: IJobParameters['unique'], opts?: IJobParameters['uniqueOpts']) {
		this.attrs.unique = unique;
		this.attrs.uniqueOpts = opts;
		return this;
	}

	schedule(time) {
		const d = new Date(time);

		this.attrs.nextRunAt = Number.isNaN(d.getTime()) ? date(time) : d;

		return this;
	}

	/**
	 * Sets priority of the job
	 * @param {String} priority priority of when job should be queued
	 * @returns {exports} instance of Job
	 */
	priority(priority: 'lowest' | 'low' | 'normal' | 'high' | 'highest' | number) {
		this.attrs.priority = parsePriority(priority);
		return this;
	}

	fail(reason: Error | string) {
		if (reason instanceof Error) {
			reason = reason.message;
		}

		this.attrs.failReason = reason;
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

	isRunning() {
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

	save() {
		return this.agenda.db.saveJob(this);
	}

	remove(): Promise<number> {
		return this.agenda.cancel({ _id: this.attrs._id });
	}

	async touch(progress?: number): Promise<void> {
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
		} catch (err) {
			this.attrs.nextRunAt = null;
			this.fail(err);
		}

		return this;
	}

	async run() {
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
						const result = (definition.fn as DefinitionProcessor<DATA, (err?) => void>)(
							this,
							err => {
								if (err) {
									reject(err);
									return;
								}
								resolve();
							}
						);
						if (this.isPromise(result)) {
							(result as any).catch(err => reject(err));
						}
					} catch (err) {
						reject(err);
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
		} catch (err) {
			log('[%s:%s] unknown error occurred', this.attrs.name, this.attrs._id);

			this.fail(err);

			this.agenda.emit('fail', err, this);
			this.agenda.emit(`fail:${this.attrs.name}`, err, this);
			log('[%s:%s] has failed [%s]', this.attrs.name, this.attrs._id, err.message);
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

	private isPromise(value): value is Promise<void> {
		return !!(value && typeof value.then === 'function');
	}
}
