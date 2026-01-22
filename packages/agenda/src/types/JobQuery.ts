import type { IJobParameters, JobId } from './JobParameters.js';

/**
 * Computed job states based on job timestamps.
 * These are derived from job data, not stored in the database.
 */
export type JobState = 'running' | 'scheduled' | 'queued' | 'completed' | 'failed' | 'repeating';

/**
 * Overview statistics for a single job name
 */
export interface IJobsOverview {
	name: string;
	total: number;
	running: number;
	scheduled: number;
	queued: number;
	completed: number;
	failed: number;
	repeating: number;
}

/**
 * Job with computed state
 */
export interface IJobWithState<DATA = unknown> extends IJobParameters<DATA> {
	_id: JobId;
	state: JobState;
}

/**
 * Sort direction for job queries
 */
export type SortDirection = 1 | -1;

/**
 * Sort options for job queries (database-agnostic)
 */
export interface IJobsSort {
	nextRunAt?: SortDirection;
	lastRunAt?: SortDirection;
	lastFinishedAt?: SortDirection;
	priority?: SortDirection;
	name?: SortDirection;
	data?: SortDirection;
}

/**
 * Database-agnostic query options for jobs
 */
export interface IJobsQueryOptions {
	/** Filter by job name */
	name?: string;
	/** Filter by job names (multiple) */
	names?: string[];
	/** Filter by computed state */
	state?: JobState;
	/** Filter by job ID */
	id?: string;
	/** Filter by job IDs (multiple) */
	ids?: string[];
	/** Text to search in job name */
	search?: string;
	/** Filter by job data (exact match or partial object match) */
	data?: unknown;
	/** Include disabled jobs (default: true) */
	includeDisabled?: boolean;
	/** Sort order */
	sort?: IJobsSort;
	/** Number of jobs to skip (pagination) */
	skip?: number;
	/** Maximum number of jobs to return */
	limit?: number;
}

/**
 * Result of jobs query with state computation
 */
export interface IJobsResult<DATA = unknown> {
	jobs: IJobWithState<DATA>[];
	/** Total count (before pagination, after state filter) */
	total: number;
}

/**
 * Compute the state for a job based on its timestamps
 */
export function computeJobState(job: IJobParameters, now: Date = new Date()): JobState {
	const { lockedAt, lastFinishedAt, failedAt, nextRunAt, repeatInterval } = job;

	// Running: currently locked and processing
	if (lockedAt) {
		return 'running';
	}

	// Failed: has failed and failure is more recent than completion
	if (failedAt && (!lastFinishedAt || failedAt > lastFinishedAt)) {
		return 'failed';
	}

	// Repeating: has repeat interval and hasn't failed
	if (repeatInterval) {
		return 'repeating';
	}

	// Scheduled: next run is in the future
	if (nextRunAt && nextRunAt > now) {
		return 'scheduled';
	}

	// Queued: next run is now or past (ready to run)
	if (nextRunAt && nextRunAt <= now) {
		return 'queued';
	}

	// Completed: has finished and either no failure or completion is more recent
	if (lastFinishedAt && (!failedAt || lastFinishedAt >= failedAt)) {
		return 'completed';
	}

	// Default to completed if nothing else matches
	return 'completed';
}
