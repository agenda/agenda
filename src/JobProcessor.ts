import * as debug from 'debug';
import { Job } from './Job';
import { IJobDefinition } from './types/JobDefinition';
import { JobProcessingQueue } from './JobProcessingQueue';
import type { Agenda } from './index';

const log = debug('agenda:jobProcessor');

/**
 * Process methods for jobs
 * @param {Job} extraJob job to run immediately
 * @returns {undefined}
 */
export class JobProcessor {
	private jobStatus: {
		[name: string]:
			| {
					running: number;
					locked: number;
			  }
			| undefined;
	} = {};

	async getStatus() {
		return {
			queueSize: await this.agenda.db.getQueueSize(),
			jobStatus: this.jobStatus,
			runningJobs: this.runningJobs.length,
			lockedJobs: this.lockedJobs.length,
			jobsToLock: this.jobsToLock.length,
			isLockingOnTheFly: this.isLockingOnTheFly
		};
	}

	private nextScanAt = new Date();

	private jobQueue: JobProcessingQueue = new JobProcessingQueue(this.agenda.definitions);

	private runningJobs: Job[] = [];

	private lockedJobs: Job[] = [];

	private jobsToLock: Job[] = [];

	private isLockingOnTheFly = false;

	private isRunning = true;

	private processInterval?: ReturnType<typeof setInterval>;

	constructor(
		private agenda: Agenda,
		private maxConcurrency: number,
		private totalLockLimit: number,
		private processEvery: number
	) {
		log('creating interval to call processJobs every [%dms]', processEvery);
		this.processInterval = setInterval(() => this.process(), processEvery);
	}

	stop(): Job[] {
		log('stop job processor', this.isRunning);
		this.isRunning = false;

		if (this.processInterval) {
			clearInterval(this.processInterval);
			this.processInterval = undefined;
		}

		return this.lockedJobs;
	}

	// processJobs
	async process(extraJob?: Job) {
		// Make sure an interval has actually been set
		// Prevents race condition with 'Agenda.stop' and already scheduled run
		if (!this.isRunning) {
			log('process: JobProcessor got stopped already, returning', this);
			return;
		}

		// Determine whether or not we have a direct process call!
		if (!extraJob) {
			log('starting to process jobs');

			// Go through each jobName set in 'Agenda.process' and fill the queue with the next jobs
			await Promise.all(
				Object.keys(this.agenda.definitions).map(async jobName => {
					log('queuing up job to process: [%s]', jobName);
					await this.jobQueueFilling(jobName);
				})
			);
		} else if (
			this.agenda.definitions[extraJob.attrs.name] &&
			// If the extraJob would have been processed in an older scan, process the job immediately
			extraJob.attrs.nextRunAt &&
			extraJob.attrs.nextRunAt < this.nextScanAt
		) {
			log(
				'[%s:%s] job would have ran by nextScanAt, processing the job immediately',
				extraJob.attrs.name
			);
			// Add the job to list of jobs to lock and then lock it immediately!
			this.jobsToLock.push(extraJob);
			await this.lockOnTheFly();
		}
	}

	/**
	 * Returns true if a job of the specified name can be locked.
	 * Considers maximum locked jobs at any time if self._lockLimit is > 0
	 * Considers maximum locked jobs of the specified name at any time if jobDefinition.lockLimit is > 0
	 * @param {String} name name of job to check if we should lock or not
	 * @returns {boolean} whether or not you should lock job
	 */
	shouldLock(name) {
		const jobDefinition = this.agenda.definitions[name];
		let shouldLock = true;
		// global lock limit
		if (this.totalLockLimit && this.totalLockLimit <= this.lockedJobs.length) {
			shouldLock = false;
		}

		// job specific lock limit
		const status = this.jobStatus[name];
		if (jobDefinition.lockLimit && status && jobDefinition.lockLimit <= status.locked) {
			shouldLock = false;
		}

		log(
			'job [%s] lock status: shouldLock = %s',
			name,
			shouldLock,
			this.jobQueue.length,
			this.lockedJobs.length,
			this.totalLockLimit
		);
		return shouldLock;
	}

	/**
	 * Internal method that adds jobs to be processed to the local queue
	 * @param {*} jobs Jobs to queue
	 * @param {boolean} inFront puts the job in front of queue if true
	 * @returns {undefined}
	 */
	private enqueueJob(job: Job) {
		this.jobQueue.insert(job);
	}

	/**
	 * Internal method that will lock a job and store it on MongoDB
	 * This method is called when we immediately start to process a job without using the process interval
	 * We do this because sometimes jobs are scheduled but will be run before the next process time
	 * @returns {undefined}
	 */
	async lockOnTheFly() {
		// Already running this? Return
		if (this.isLockingOnTheFly) {
			log('lockOnTheFly() already running, returning');
			return;
		}

		// Don't have any jobs to run? Return
		if (this.jobsToLock.length === 0) {
			log('no jobs to current lock on the fly, returning');
			return;
		}

		// Set that we are running this
		try {
			this.isLockingOnTheFly = true;

			// Grab a job that needs to be locked
			const job = this.jobsToLock.pop();

			if (job) {
				// If locking limits have been hit, stop locking on the fly.
				// Jobs that were waiting to be locked will be picked up during a
				// future locking interval.
				if (!this.shouldLock(job.attrs.name)) {
					log('lock limit hit for: [%s]', job.attrs.name);
					this.jobsToLock = [];
					return;
				}

				// Lock the job in MongoDB!
				const resp = await this.agenda.db.lockJob(job);

				if (resp) {
					// Before en-queing job make sure we haven't exceed our lock limits
					if (!this.shouldLock(resp.name)) {
						log(
							'lock limit reached while job was locked in database. Releasing lock on [%s]',
							resp.name
						);
						job.attrs.lockedAt = undefined;
						await job.save();

						this.jobsToLock = [];
						return;
					}
					const jobToEnqueue = new Job(this.agenda, resp);
					log('found job [%s] that can be locked on the fly', jobToEnqueue.attrs.name);
					this.lockedJobs.push(jobToEnqueue);
					this.updateStatus(jobToEnqueue.attrs.name, 'locked', +1);
					this.enqueueJob(jobToEnqueue);
					this.jobProcessing();
				}
			}
		} finally {
			// Mark lock on fly is done for now
			this.isLockingOnTheFly = false;
		}

		// Re-run in case anything is in the queue
		await this.lockOnTheFly();
	}

	private async findAndLockNextJob(
		jobName: string,
		definition: IJobDefinition
	): Promise<Job | undefined> {
		const lockDeadline = new Date(Date.now().valueOf() - definition.lockLifetime);
		log('findAndLockNextJob(%s, [Function])', jobName);

		// Find ONE and ONLY ONE job and set the 'lockedAt' time so that job begins to be processed
		const result = await this.agenda.db.getNextJobToRun(jobName, this.nextScanAt, lockDeadline);

		let job;
		if (result) {
			log('found a job available to lock, creating a new job on Agenda with id [%s]', result._id);
			job = new Job(this.agenda, result);
		}

		return job;
	}

	/**
	 * Internal method used to fill a queue with jobs that can be run
	 * @param {String} name fill a queue with specific job name
	 * @returns {undefined}
	 */
	async jobQueueFilling(name) {
		// Don't lock because of a limit we have set (lockLimit, etc)
		if (!this.shouldLock(name)) {
			log('lock limit reached in queue filling for [%s]', name);
			return;
		}

		// Set the date of the next time we are going to run _processEvery function
		const now = new Date();
		this.nextScanAt = new Date(now.valueOf() + this.processEvery);

		// For this job name, find the next job to run and lock it!
		try {
			const job = await this.findAndLockNextJob(name, this.agenda.definitions[name]);
			// Still have the job?
			// 1. Add it to lock list
			// 2. Add count of locked jobs
			// 3. Queue the job to actually be run now that it is locked
			// 4. Recursively run this same method we are in to check for more available jobs of same type!
			if (job) {
				// Before en-queing job make sure we haven't exceed our lock limits
				if (!this.shouldLock(name)) {
					log('lock limit reached before job was returned. Releasing lock on [%s]', name);
					job.attrs.lockedAt = undefined;
					await job.save(); // this.saveJob(job);
					return;
				}

				log('[%s:%s] job locked while filling queue', name, job.attrs._id);
				this.lockedJobs.push(job);
				this.updateStatus(job.attrs.name, 'locked', +1);

				this.enqueueJob(job);
				await this.jobQueueFilling(name);
				this.jobProcessing();
			}
		} catch (error) {
			log('[%s] job lock failed while filling queue', name, error);
		}
	}

	/**
	 * Internal method that processes any jobs in the local queue (array)
	 * @returns {undefined}
	 */
	private jobProcessing() {
		// Ensure we have jobs
		if (this.jobQueue.length === 0) {
			return;
		}

		const now = new Date();

		// Check if there is any job that is not blocked by concurrency
		const job = this.jobQueue.returnNextConcurrencyFreeJob(this.jobStatus);

		if (job) {
			log('[%s:%s] there is a job to process', job.attrs.name, job.attrs._id);

			// If the 'nextRunAt' time is older than the current time, run the job
			// Otherwise, setTimeout that gets called at the time of 'nextRunAt'
			if (job.attrs.nextRunAt <= now) {
				log(
					'[%s:%s] nextRunAt is in the past, run the job immediately',
					job.attrs.name,
					job.attrs._id
				);
				this.runOrRetry();
			} else {
				const runIn = job.attrs.nextRunAt.getTime() - now.getTime();
				log(
					'[%s:%s] nextRunAt is in the future, calling setTimeout(%d)',
					job.attrs.name,
					job.attrs._id,
					runIn
				);
				setTimeout(() => {
					this.jobProcessing();
				}, runIn);
			}
		}
	}

	/**
	 * Internal method that tries to run a job and if it fails, retries again!
	 * @returns {undefined}
	 */
	private async runOrRetry() {
		if (!this.isRunning) {
			// const a = new Error();
			// console.log('STACK', a.stack);
			log('JobProcessor got stopped already while calling runOrRetry, returning!', this);
			return;
		}

		const job = this.jobQueue.pop();
		if (!job) {
			console.info('empty queue');
			return;
		}

		const jobDefinition = this.agenda.definitions[job.attrs.name];
		const status = this.jobStatus[job.attrs.name];

		if (
			(!jobDefinition.concurrency || !status || status.running < jobDefinition.concurrency) &&
			this.runningJobs.length < this.maxConcurrency
		) {
			// Get the deadline of when the job is not supposed to go past for locking
			const lockDeadline = new Date(Date.now() - jobDefinition.lockLifetime);

			// This means a job has "expired", as in it has not been "touched" within the lockoutTime
			// Remove from local lock
			// NOTE: Shouldn't we update the 'lockedAt' value in MongoDB so it can be picked up on restart?
			if (job.attrs.lockedAt && job.attrs.lockedAt < lockDeadline) {
				log('[%s:%s] job lock has expired, freeing it up', job.attrs.name, job.attrs._id);
				let lockedJobIndex = this.lockedJobs.indexOf(job);
				if (lockedJobIndex === -1) {
					// lookup by id
					lockedJobIndex = this.lockedJobs.findIndex(
						j => j.attrs._id?.toString() === job.attrs._id?.toString()
					);
				}
				if (lockedJobIndex === -1) {
					throw new Error(`cannot find job ${job.attrs._id} in locked jobs queue?`);
				}

				this.lockedJobs.splice(lockedJobIndex, 1);
				this.updateStatus(job.attrs.name, 'locked', -1);
				this.jobProcessing();
				return;
			}

			// Add to local "running" queue
			this.runningJobs.push(job);
			this.updateStatus(job.attrs.name, 'running', 1);

			try {
				log('[%s:%s] processing job', job.attrs.name, job.attrs._id);
				// CALL THE ACTUAL METHOD TO PROCESS THE JOB!!!
				await job.run();

				// Job isn't in running jobs so throw an error
				if (!this.runningJobs.includes(job)) {
					log(
						'[%s] callback was called, job must have been marked as complete already',
						job.attrs._id
					);
					throw new Error(
						`callback already called - job ${job.attrs.name} already marked complete`
					);
				}
			} catch (err) {
				job.agenda.emit('error', err);
			} finally {
				// Remove the job from the running queue
				let runningJobIndex = this.runningJobs.indexOf(job);
				if (runningJobIndex === -1) {
					// lookup by id
					runningJobIndex = this.runningJobs.findIndex(
						j => j.attrs._id?.toString() === job.attrs._id?.toString()
					);
				}
				if (runningJobIndex === -1) {
					// eslint-disable-next-line no-unsafe-finally
					throw new Error(`cannot find job ${job.attrs._id} in running jobs queue?`);
				}
				this.runningJobs.splice(runningJobIndex, 1);
				this.updateStatus(job.attrs.name, 'running', -1);

				// Remove the job from the locked queue
				let lockedJobIndex = this.lockedJobs.indexOf(job);
				if (lockedJobIndex === -1) {
					// lookup by id
					lockedJobIndex = this.lockedJobs.findIndex(
						j => j.attrs._id?.toString() === job.attrs._id?.toString()
					);
				}
				if (lockedJobIndex === -1) {
					// eslint-disable-next-line no-unsafe-finally
					throw new Error(`cannot find job ${job.attrs._id} in locked jobs queue?`);
				}
				this.lockedJobs.splice(lockedJobIndex, 1);
				this.updateStatus(job.attrs.name, 'locked', -1);
			}

			// Re-process jobs now that one has finished
			setImmediate(() => this.jobProcessing());
		} else {
			// Run the job immediately by putting it on the top of the queue
			log(
				'[%s:%s] concurrency preventing immediate run, pushing job to top of queue',
				job.attrs.name,
				job.attrs._id
			);
			this.enqueueJob(job);
		}
	}

	private updateStatus(name: string, key: 'locked' | 'running', number: -1 | 1) {
		if (!this.jobStatus[name]) {
			this.jobStatus[name] = {
				locked: 0,
				running: 0
			};
		}
		if ((this.jobStatus[name]![key] > 0 && number === -1) || number === 1) {
			this.jobStatus[name]![key] += number;
		}
	}
}
