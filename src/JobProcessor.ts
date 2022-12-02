import * as debug from 'debug';
import type { IAgendaJobStatus, IAgendaStatus } from './types/AgendaStatus';
import type { IJobDefinition } from './types/JobDefinition';
import type { Agenda, JobWithId } from './index';
import type { IJobParameters } from './types/JobParameters';
import { Job } from './Job';
import { JobProcessingQueue } from './JobProcessingQueue';

const log = debug('agenda:jobProcessor');

// eslint-disable-next-line @typescript-eslint/no-var-requires,global-require
const { version: agendaVersion } = require('../package.json');

const MAX_SAFE_32BIT_INTEGER = 2 ** 31; // Math.pow(2,31);

/**
 * @class
 * Process methods for jobs
 */
export class JobProcessor {
	private jobStatus: {
		[name: string]: { running: number; locked: number } | undefined;
	} = {};

	private localQueueProcessing = 0;

	async getStatus(fullDetails = false): Promise<IAgendaStatus> {
		const jobStatus = Object.keys(this.jobStatus).reduce((obj, key) => {
			// eslint-disable-next-line no-param-reassign
			obj[key] = {
				...this.jobStatus[key],
				config: this.agenda.definitions[key]
			};
			return obj;
		}, {}) as IAgendaJobStatus;

		return {
			version: agendaVersion,
			queueName: this.agenda.attrs.name,
			totalQueueSizeDB: await this.agenda.db.getQueueSize(),
			internal: {
				localQueueProcessing: this.localQueueProcessing
			},
			config: {
				totalLockLimit: this.totalLockLimit,
				maxConcurrency: this.maxConcurrency,
				processEvery: this.processEvery
			},
			jobStatus,
			queuedJobs: !fullDetails
				? this.jobQueue.length
				: this.jobQueue.getQueue().map(job => ({
						...job.toJson(),
						canceled: job.getCanceledMessage()
				  })),
			runningJobs: !fullDetails
				? this.runningJobs.length
				: this.runningJobs.map(job => ({
						...job.toJson(),
						canceled: job.getCanceledMessage()
				  })),
			lockedJobs: !fullDetails
				? this.lockedJobs.length
				: this.lockedJobs.map(job => ({
						...job.toJson(),
						canceled: job.getCanceledMessage()
				  })),
			jobsToLock: !fullDetails
				? this.jobsToLock.length
				: this.jobsToLock.map(job => ({
						...job.toJson(),
						canceled: job.getCanceledMessage()
				  })),
			isLockingOnTheFly: this.isLockingOnTheFly
		};
	}

	private nextScanAt = new Date();

	private jobQueue: JobProcessingQueue = new JobProcessingQueue(this.agenda);

	private runningJobs: JobWithId[] = [];

	private lockedJobs: JobWithId[] = [];

	private jobsToLock: JobWithId[] = [];

	private isLockingOnTheFly = false;

	private isJobQueueFilling = new Map<string, boolean>();

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
		this.process();
	}

	stop(): JobWithId[] {
		log.extend('stop')('stop job processor', this.isRunning);
		this.isRunning = false;

		if (this.processInterval) {
			clearInterval(this.processInterval);
			this.processInterval = undefined;
		}

		return this.lockedJobs;
	}

	// processJobs
	async process(extraJob?: JobWithId): Promise<void> {
		// Make sure an interval has actually been set
		// Prevents race condition with 'Agenda.stop' and already scheduled run
		if (!this.isRunning) {
			log.extend('process')('JobProcessor got stopped already, returning');
			return;
		}

		// Determine whether or not we have a direct process call!
		if (!extraJob) {
			log.extend('process')('starting to process jobs');

			// Go through each jobName set in 'Agenda.process' and fill the queue with the next jobs
			await Promise.all(
				Object.keys(this.agenda.definitions).map(async jobName => {
					log.extend('process')('queuing up job to process: [%s]', jobName);
					await this.jobQueueFilling(jobName);
				})
			);
			this.jobProcessing();
		} else if (
			this.agenda.definitions[extraJob.attrs.name] &&
			// If the extraJob would have been processed in an older scan, process the job immediately
			extraJob.attrs.nextRunAt &&
			extraJob.attrs.nextRunAt < this.nextScanAt
		) {
			log.extend('process')(
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
	shouldLock(name: string): boolean {
		const jobDefinition = this.agenda.definitions[name];
		let shouldLock = true;
		// global lock limit
		if (this.totalLockLimit && this.lockedJobs.length >= this.totalLockLimit) {
			shouldLock = false;
		}

		// job specific lock limit
		const status = this.jobStatus[name];
		if (jobDefinition.lockLimit && status && status.locked >= jobDefinition.lockLimit) {
			shouldLock = false;
		}

		log.extend('shouldLock')(
			'job [%s] lock status: shouldLock = %s',
			name,
			shouldLock,
			`${status?.locked} >= ${jobDefinition?.lockLimit}`,
			`${this.lockedJobs.length} >= ${this.totalLockLimit}`
		);
		return shouldLock;
	}

	/**
	 * Internal method that adds jobs to be processed to the local queue
	 * @param {*} jobs Jobs to queue
	 * @param {boolean} inFront puts the job in front of queue if true
	 * @returns {undefined}
	 */
	private enqueueJob(job: Job): void {
		this.jobQueue.insert(job);
	}

	/**
	 * Internal method that will lock a job and store it on MongoDB
	 * This method is called when we immediately start to process a job without using the process interval
	 * We do this because sometimes jobs are scheduled but will be run before the next process time
	 * @returns {undefined}
	 */
	async lockOnTheFly(): Promise<void> {
		// Already running this? Return
		if (this.isLockingOnTheFly) {
			log.extend('lockOnTheFly')('already running, returning');
			return;
		}

		// Don't have any jobs to run? Return
		if (this.jobsToLock.length === 0) {
			log.extend('lockOnTheFly')('no jobs to current lock on the fly, returning');
			return;
		}

		this.isLockingOnTheFly = true;

		// Set that we are running this
		try {
			// Grab a job that needs to be locked
			const job = this.jobsToLock.pop();

			if (job) {
				if (this.isJobQueueFilling.has(job.attrs.name)) {
					log.extend('lockOnTheFly')('jobQueueFilling already running for: %s', job.attrs.name);
					return;
				}

				// If locking limits have been hit, stop locking on the fly.
				// Jobs that were waiting to be locked will be picked up during a
				// future locking interval.
				if (!this.shouldLock(job.attrs.name)) {
					log.extend('lockOnTheFly')('lock limit hit for: [%s:%S]', job.attrs.name, job.attrs._id);
					this.jobsToLock = [];
					return;
				}

				// Lock the job in MongoDB!
				const resp = await this.agenda.db.lockJob(job);

				if (resp) {
					if (job.attrs.name !== resp.name) {
						throw new Error(
							`got different job name: ${resp.name} (actual) !== ${job.attrs.name} (expected)`
						);
					}

					const jobToEnqueue = new Job(this.agenda, resp, true) as JobWithId;

					// Before en-queing job make sure we haven't exceed our lock limits
					if (!this.shouldLock(jobToEnqueue.attrs.name)) {
						log.extend('lockOnTheFly')(
							'lock limit reached while job was locked in database. Releasing lock on [%s]',
							jobToEnqueue.attrs.name
						);
						this.agenda.db.unlockJob(jobToEnqueue);

						this.jobsToLock = [];
						return;
					}

					log.extend('lockOnTheFly')(
						'found job [%s:%s] that can be locked on the fly',
						jobToEnqueue.attrs.name,
						jobToEnqueue.attrs._id
					);
					this.updateStatus(jobToEnqueue.attrs.name, 'locked', +1);
					this.lockedJobs.push(jobToEnqueue);
					this.enqueueJob(jobToEnqueue);
					this.jobProcessing();
				} else {
					log.extend('lockOnTheFly')('cannot lock job [%s] on the fly', job.attrs.name);
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
	): Promise<JobWithId | undefined> {
		const lockDeadline = new Date(Date.now().valueOf() - definition.lockLifetime);
		log.extend('findAndLockNextJob')(
			`looking for lockable jobs for ${jobName} (lock dead line = ${lockDeadline})`
		);

		// Find ONE and ONLY ONE job and set the 'lockedAt' time so that job begins to be processed
		const result = await this.agenda.db.getNextJobToRun(jobName, this.nextScanAt, lockDeadline);

		if (result) {
			log.extend('findAndLockNextJob')(
				'found a job available to lock, creating a new job on Agenda with id [%s]',
				result._id
			);
			return new Job(this.agenda, result, true) as JobWithId;
		}

		return undefined;
	}

	/**
	 * Internal method used to fill a queue with jobs that can be run
	 * @param {String} name fill a queue with specific job name
	 * @returns {undefined}
	 */
	private async jobQueueFilling(name: string): Promise<void> {
		this.isJobQueueFilling.set(name, true);

		try {
			// Don't lock because of a limit we have set (lockLimit, etc)
			if (!this.shouldLock(name)) {
				log.extend('jobQueueFilling')('lock limit reached in queue filling for [%s]', name);
				return;
			}

			// Set the date of the next time we are going to run _processEvery function
			const now = new Date();
			this.nextScanAt = new Date(now.valueOf() + this.processEvery);

			// For this job name, find the next job to run and lock it!
			const job = await this.findAndLockNextJob(name, this.agenda.definitions[name]);

			// Still have the job?
			// 1. Add it to lock list
			// 2. Add count of locked jobs
			// 3. Queue the job to actually be run now that it is locked
			// 4. Recursively run this same method we are in to check for more available jobs of same type!
			if (job) {
				if (job.attrs.name !== name) {
					throw new Error(
						`got different job name: ${job.attrs.name} (actual) !== ${name} (expected)`
					);
				}

				// Before en-queing job make sure we haven't exceed our lock limits
				if (!this.shouldLock(name)) {
					log.extend('jobQueueFilling')(
						'lock limit reached before job was returned. Releasing lock on [%s]',
						name
					);
					this.agenda.db.unlockJob(job);
					return;
				}

				log.extend('jobQueueFilling')(
					'[%s:%s] job locked while filling queue',
					name,
					job.attrs._id
				);
				this.updateStatus(name, 'locked', +1);
				this.lockedJobs.push(job);

				this.enqueueJob(job);
				await this.jobQueueFilling(name);
			} else {
				log.extend('jobQueueFilling')('Cannot lock job [%s]', name);
			}
		} catch (error) {
			log.extend('jobQueueFilling')('[%s] job lock failed while filling queue', name, error);
			this.agenda.emit('error', error);
		} finally {
			this.isJobQueueFilling.delete(name);
		}
	}

	/**
	 * Internal method that processes any jobs in the local queue (array)
	 * handledJobs keeps list of already processed jobs
	 * @returns {undefined}
	 */
	private async jobProcessing(handledJobs: IJobParameters['_id'][] = []) {
		// Ensure we have jobs
		if (this.jobQueue.length === 0) {
			return;
		}

		this.localQueueProcessing += 1;

		try {
			const now = new Date();

			// Check if there is any job that is not blocked by concurrency
			const job = this.jobQueue.returnNextConcurrencyFreeJob(this.jobStatus, handledJobs);

			if (!job) {
				log.extend('jobProcessing')('[%s:%s] there is no job to process');
				return;
			}

			this.jobQueue.remove(job);

			if (!(await job.isExpired())) {
				// check if job has expired (and therefore probably got picked up again by another queue in the meantime)
				// before it even has started to run

				log.extend('jobProcessing')(
					'[%s:%s] there is a job to process (priority = %d)',
					job.attrs.name,
					job.attrs._id,
					job.attrs.priority,
					job.gotTimerToExecute
				);

				// If the 'nextRunAt' time is older than the current time, run the job
				// Otherwise, setTimeout that gets called at the time of 'nextRunAt'
				if (!job.attrs.nextRunAt || job.attrs.nextRunAt <= now) {
					log.extend('jobProcessing')(
						'[%s:%s] nextRunAt is in the past, run the job immediately',
						job.attrs.name,
						job.attrs._id
					);
					this.runOrRetry(job);
				} else {
					const runIn = job.attrs.nextRunAt.getTime() - now.getTime();
					if (runIn > this.processEvery) {
						// this job is not in the near future, remove it (it will be picked up later)
						log.extend('runOrRetry')(
							'[%s:%s] job is too far away, freeing it up',
							job.attrs.name,
							job.attrs._id
						);
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
					} else {
						log.extend('jobProcessing')(
							'[%s:%s] nextRunAt is in the future, calling setTimeout(%d)',
							job.attrs.name,
							job.attrs._id,
							runIn
						);
						// re add to queue (puts it at the right position in the queue)
						this.jobQueue.insert(job);
						// ensure every job gets a timer to run at the near future time (but also ensure this time is set only once)
						if (!job.gotTimerToExecute) {
							job.gotTimerToExecute = true;
							setTimeout(
								() => {
									this.jobProcessing();
								},
								runIn > MAX_SAFE_32BIT_INTEGER ? MAX_SAFE_32BIT_INTEGER : runIn
							); // check if runIn is higher than unsined 32 bit int, if so, use this time to recheck,
							// because setTimeout will run in an overflow otherwise and reprocesses immediately
						}
					}
				}
			}

			handledJobs.push(job.attrs._id);

			if (job && this.localQueueProcessing < this.maxConcurrency) {
				// additionally run again and check if there are more jobs that we can process right now (as long concurrency not reached)
				setImmediate(() => this.jobProcessing(handledJobs));
			}
		} finally {
			this.localQueueProcessing -= 1;
		}
	}

	/**
	 * Internal method that tries to run a job and if it fails, retries again!
	 * @returns {boolean} processed a job or not
	 */
	private async runOrRetry(job: JobWithId): Promise<void> {
		if (!this.isRunning) {
			// const a = new Error();
			// console.log('STACK', a.stack);
			log.extend('runOrRetry')(
				'JobProcessor got stopped already while calling runOrRetry, returning!'
			);
			return;
		}

		const jobDefinition = this.agenda.definitions[job.attrs.name];
		const status = this.jobStatus[job.attrs.name];

		if (
			(!jobDefinition.concurrency || !status || status.running < jobDefinition.concurrency) &&
			this.runningJobs.length < this.maxConcurrency
		) {
			// Add to local "running" queue
			this.runningJobs.push(job);
			this.updateStatus(job.attrs.name, 'running', 1);

			let jobIsRunning = true;
			try {
				log.extend('runOrRetry')('[%s:%s] processing job', job.attrs.name, job.attrs._id);

				// check if the job is still alive
				const checkIfJobIsStillAlive = () =>
					// check every "this.agenda.definitions[job.attrs.name].lockLifetime / 2"" (or at mininum every processEvery)
					new Promise<void>((resolve, reject) => {
						setTimeout(async () => {
							// when job is not running anymore, just finish
							if (!jobIsRunning) {
								log.extend('runOrRetry')(
									'[%s:%s] checkIfJobIsStillAlive detected job is not running anymore. stopping check.',
									job.attrs.name,
									job.attrs._id
								);
								resolve();
								return;
							}

							if (await job.isExpired()) {
								log.extend('runOrRetry')(
									'[%s:%s] checkIfJobIsStillAlive detected an expired job, killing it.',
									job.attrs.name,
									job.attrs._id
								);

								reject(
									new Error(
										`execution of '${job.attrs.name}' canceled, execution took more than ${
											this.agenda.definitions[job.attrs.name].lockLifetime
										}ms. Call touch() for long running jobs to keep them alive.`
									)
								);
								return;
							}

							if (!job.attrs.lockedAt) {
								log.extend('runOrRetry')(
									'[%s:%s] checkIfJobIsStillAlive detected a job without a lockedAt value, killing it.',
									job.attrs.name,
									job.attrs._id
								);

								reject(
									new Error(
										`execution of '${job.attrs.name}' canceled, no lockedAt date found. Ensure to call touch() for long running jobs to keep them alive.`
									)
								);
								return;
							}

							resolve(checkIfJobIsStillAlive());
						}, Math.max(this.processEvery / 2, this.agenda.definitions[job.attrs.name].lockLifetime / 2));
					});
				// CALL THE ACTUAL METHOD TO PROCESS THE JOB!!!
				await Promise.race([job.run(), checkIfJobIsStillAlive()]);

				log.extend('runOrRetry')(
					'[%s:%s] processing job successfull',
					job.attrs.name,
					job.attrs._id
				);

				// Job isn't in running jobs so throw an error
				if (!this.runningJobs.includes(job)) {
					log.extend('runOrRetry')(
						'[%s] callback was called, job must have been marked as complete already',
						job.attrs._id
					);
					throw new Error(
						`callback already called - job ${job.attrs.name} already marked complete`
					);
				}
			} catch (error: any) {
				job.cancel(error);
				log.extend('runOrRetry')(
					'[%s:%s] processing job failed',
					job.attrs.name,
					job.attrs._id,
					error
				);
				this.agenda.emit('error', error);
			} finally {
				jobIsRunning = false;

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
			return;
		}

		// Run the job later
		log.extend('runOrRetry')(
			'[%s:%s] concurrency preventing immediate run, pushing job to top of queue',
			job.attrs.name,
			job.attrs._id
		);
		this.enqueueJob(job);
	}

	private updateStatus(name: string, key: 'locked' | 'running', number: -1 | 1) {
		if (!this.jobStatus[name]) {
			this.jobStatus[name] = {
				locked: 0,
				running: 0
			};
		}
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		this.jobStatus[name]![key] += number;
	}
}
