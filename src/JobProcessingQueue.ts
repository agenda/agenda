// eslint-disable-next-line prettier/prettier
import type {Job, JobWithId} from './Job';
import type { IJobParameters } from './types/JobParameters';
import type { Agenda } from './index';
/**
 * @class
 */
export class JobProcessingQueue {
	private _queue: Job[];

	constructor(private agenda: Agenda) {
		this._queue = [];
	}

	get length(): number {
		return this._queue.length;
	}

	getQueue(): Job[] {
		return this._queue;
	}

	/**
	 * Pops and returns last queue element (next job to be processed) without checking concurrency.
	 * @returns {Job} Next Job to be processed
	 */
	pop(): Job | undefined {
		return this._queue.pop();
	}

	/**
	 * Inserts job in first queue position
	 * @param {Job} job job to add to queue
	 * @returns {undefined}
	 */
	/*
	push(job: Job): void {
		this._queue.push(job);
	} */

	remove(job: Job): void {
		let removeJobIndex = this._queue.indexOf(job);
		if (removeJobIndex === -1) {
			// lookup by id
			removeJobIndex = this._queue.findIndex(
				j => j.attrs._id?.toString() === job.attrs._id?.toString()
			);
		}
		if (removeJobIndex === -1) {
			throw new Error(`cannot find job ${job.attrs._id} in processing queue?`);
		}

		this._queue.splice(removeJobIndex, 1);
	}

	/**
	 * Inserts job in queue where it will be order from left to right in decreasing
	 * order of nextRunAt and priority (in case of same nextRunAt), if all values
	 * are even the first jobs to be introduced will have priority
	 * @param {Job} job job to add to queue
	 * @returns {undefined}
	 */
	insert(job: Job): void {
		const matchIndex = this._queue.findIndex(element => {
			if (
				element.attrs.nextRunAt &&
				job.attrs.nextRunAt &&
				element.attrs.nextRunAt.getTime() <= job.attrs.nextRunAt.getTime()
			) {
				if (element.attrs.nextRunAt.getTime() === job.attrs.nextRunAt.getTime()) {
					if (element.attrs.priority >= job.attrs.priority) {
						return true;
					}
				} else {
					return true;
				}
			}

			return false;
		});

		if (matchIndex === -1) {
			// put on left side of the queue
			this._queue.unshift(job);
		} else {
			this._queue.splice(matchIndex, 0, job);
		}
	}

	/**
	 * Returns (does not pop, element remains in queue) first element (always from the right)
	 * that can be processed (not blocked by concurrency execution)
	 * @param {Object} jobStatus current status of jobs
	 * @returns {Job} Next Job to be processed
	 */
	returnNextConcurrencyFreeJob(
		jobStatus: {
			[jobName: string]:
				| {
						running: number;
				  }
				| undefined;
		},
		handledJobs: IJobParameters['_id'][]
	): (JobWithId & { attrs: IJobParameters & { nextRunAt?: Date | null } }) | undefined {
		const next = (Object.keys(this._queue) as unknown as number[]).reverse().find(i => {
			const def = this.agenda.definitions[this._queue[i].attrs.name];
			const status = jobStatus[this._queue[i].attrs.name];

			// check if we have a definition
			// if there is no status available, we are good to go
			// if there is no max concurrency defined (0), we are also good to go
			// and if concurrency limit is not reached yet (actual running jobs is lower than max concurrency)
			if (
				def &&
				!handledJobs.includes(this._queue[i].attrs._id) &&
				(!status || !def.concurrency || status.running < def.concurrency)
			) {
				return true;
			}
			return false;
		});

		return next !== undefined
			? (this._queue[next] as JobWithId & { attrs: IJobParameters & { nextRunAt: Date } })
			: undefined;
	}
}
