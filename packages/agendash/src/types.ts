import type { Agenda } from 'agenda';

/**
 * Query parameters for the API
 */
export interface IApiQueryParams {
	/** Filter by job name */
	name?: string;
	/** Filter by computed state */
	state?: string;
	/** Text to search in job name */
	search?: string;
	/** Property to search in (deprecated, kept for compatibility) */
	property?: string;
	/** Whether search is for ObjectId (deprecated) */
	isObjectId?: string;
	/** Number of jobs to skip (pagination) */
	skip?: number;
	/** Maximum number of jobs to return */
	limit?: number;
}

/**
 * Frontend job data structure (nested under 'job' key)
 */
export interface IFrontendJobData {
	_id: string;
	name: string;
	data?: unknown;
	priority?: number;
	nextRunAt?: Date | null;
	lastRunAt?: Date | null;
	lastFinishedAt?: Date | null;
	lockedAt?: Date | null;
	failedAt?: Date | null;
	failCount?: number;
	failReason?: string;
	repeatInterval?: string | number;
	repeatTimezone?: string;
}

/**
 * Frontend job structure with state flags
 */
export interface IFrontendJob {
	job: IFrontendJobData;
	running: boolean;
	scheduled: boolean;
	queued: boolean;
	completed: boolean;
	failed: boolean;
	repeating: boolean;
}

/**
 * Frontend overview structure with displayName
 */
export interface IFrontendOverview {
	displayName: string;
	total: number;
	running: number;
	scheduled: number;
	queued: number;
	completed: number;
	failed: number;
	repeating: number;
}

/**
 * Response from the API
 */
export interface IApiResponse {
	overview: IFrontendOverview[];
	jobs: IFrontendJob[];
	total: number;
	totalPages: number;
}

/**
 * Options for requeuing jobs
 */
export interface IRequeueRequest {
	jobIds: string[];
}

/**
 * Response from requeue operation
 */
export interface IRequeueResponse {
	requeuedCount: number;
}

/**
 * Options for deleting jobs
 */
export interface IDeleteRequest {
	jobIds: string[];
}

/**
 * Response from delete operation
 */
export interface IDeleteResponse {
	deleted: boolean;
	deletedCount?: number;
}

/**
 * Options for creating a job
 */
export interface ICreateJobRequest {
	jobName: string;
	jobSchedule?: string;
	jobRepeatEvery?: string;
	jobData?: unknown;
}

/**
 * Response from create operation
 */
export interface ICreateJobResponse {
	created: boolean;
}

/**
 * Agendash controller interface
 */
export interface IAgendashController {
	getJobs(params: IApiQueryParams): Promise<IApiResponse>;
	requeueJobs(ids: string[]): Promise<IRequeueResponse>;
	deleteJobs(ids: string[]): Promise<IDeleteResponse>;
	createJob(options: ICreateJobRequest): Promise<ICreateJobResponse>;
}

/**
 * Factory type for creating Agendash middleware
 */
export type AgendashMiddlewareFactory<T> = (agenda: Agenda) => T;
