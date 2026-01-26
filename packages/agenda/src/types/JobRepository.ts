import type { JobParameters, JobId } from './JobParameters.js';
import type { JobsQueryOptions, JobsResult, JobsOverview } from './JobQuery.js';

/**
 * Options passed to repository methods that modify jobs
 */
export interface JobRepositoryOptions {
	/** Name to set as lastModifiedBy on the job */
	lastModifiedBy?: string;
}

/**
 * Options for removing jobs (database-agnostic)
 */
export interface RemoveJobsOptions {
	/** Remove job by ID */
	id?: JobId | string;
	/** Remove jobs by IDs */
	ids?: (JobId | string)[];
	/** Remove jobs by name */
	name?: string;
	/** Remove jobs by names (include) */
	names?: string[];
	/** Remove jobs NOT matching these names (exclude) */
	notNames?: string[];
	/** Remove jobs matching data */
	data?: unknown;
}

/**
 * Database-agnostic job repository interface.
 * Implementations can be created for MongoDB, PostgreSQL, etc.
 */
export interface JobRepository {
	/**
	 * Connect to the database
	 */
	connect(): Promise<void>;

	/**
	 * Query jobs with filtering, pagination, and state computation
	 */
	queryJobs(options?: JobsQueryOptions): Promise<JobsResult>;

	/**
	 * Get overview statistics for all job types
	 */
	getJobsOverview(): Promise<JobsOverview[]>;

	/**
	 * Get all distinct job names
	 */
	getDistinctJobNames(): Promise<string[]>;

	/**
	 * Get a single job by ID
	 */
	getJobById(id: string): Promise<JobParameters | null>;

	/**
	 * Get count of jobs ready to run (nextRunAt < now)
	 */
	getQueueSize(): Promise<number>;

	/**
	 * Remove jobs matching the given options
	 * @returns Number of jobs removed
	 */
	removeJobs(options: RemoveJobsOptions): Promise<number>;

	/**
	 * Save a job (insert or update)
	 */
	saveJob<DATA = unknown>(
		job: JobParameters<DATA>,
		options: JobRepositoryOptions | undefined
	): Promise<JobParameters<DATA>>;

	/**
	 * Update job state fields (lockedAt, lastRunAt, progress, etc.)
	 */
	saveJobState(job: JobParameters, options: JobRepositoryOptions | undefined): Promise<void>;

	/**
	 * Attempt to lock a job for processing
	 * @returns The locked job data, or undefined if lock failed
	 */
	lockJob(
		job: JobParameters,
		options: JobRepositoryOptions | undefined
	): Promise<JobParameters | undefined>;

	/**
	 * Unlock a single job
	 */
	unlockJob(job: JobParameters): Promise<void>;

	/**
	 * Unlock multiple jobs by ID
	 */
	unlockJobs(jobIds: (JobId | string)[]): Promise<void>;

	/**
	 * Find and lock the next job to run for a given job type
	 */
	getNextJobToRun(
		jobName: string,
		nextScanAt: Date,
		lockDeadline: Date,
		now: Date | undefined,
		options: JobRepositoryOptions | undefined
	): Promise<JobParameters | undefined>;
}
