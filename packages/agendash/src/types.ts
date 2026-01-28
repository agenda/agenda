import type { Agenda, JobStateNotification, StateNotificationHandler } from 'agenda';

/**
 * Query parameters for the API
 */
export interface ApiQueryParams {
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
export interface FrontendJobData {
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
	disabled?: boolean;
	progress?: number;
}

/**
 * Frontend job structure with state flags
 */
export interface FrontendJob {
	job: FrontendJobData;
	running: boolean;
	scheduled: boolean;
	queued: boolean;
	completed: boolean;
	failed: boolean;
	repeating: boolean;
	paused: boolean;
}

/**
 * Frontend overview structure with displayName
 */
export interface FrontendOverview {
	displayName: string;
	total: number;
	running: number;
	scheduled: number;
	queued: number;
	completed: number;
	failed: number;
	repeating: number;
	paused: number;
}

/**
 * Response from the API
 */
export interface ApiResponse {
	overview: FrontendOverview[];
	jobs: FrontendJob[];
	total: number;
	totalPages: number;
}

/**
 * Options for requeuing jobs
 */
export interface RequeueRequest {
	jobIds: string[];
}

/**
 * Response from requeue operation
 */
export interface RequeueResponse {
	requeuedCount: number;
}

/**
 * Options for deleting jobs
 */
export interface DeleteRequest {
	jobIds: string[];
}

/**
 * Response from delete operation
 */
export interface DeleteResponse {
	deleted: boolean;
	deletedCount?: number;
}

/**
 * Options for creating a job
 */
export interface CreateJobRequest {
	jobName: string;
	jobSchedule?: string;
	jobRepeatEvery?: string;
	jobData?: unknown;
}

/**
 * Response from create operation
 */
export interface CreateJobResponse {
	created: boolean;
}

/**
 * Options for pausing jobs
 */
export interface PauseRequest {
	jobIds: string[];
}

/**
 * Response from pause operation
 */
export interface PauseResponse {
	pausedCount: number;
}

/**
 * Options for resuming jobs
 */
export interface ResumeRequest {
	jobIds: string[];
}

/**
 * Response from resume operation
 */
export interface ResumeResponse {
	resumedCount: number;
}

/**
 * Agendash controller interface
 */
export interface AgendashController {
	getJobs(params: ApiQueryParams): Promise<ApiResponse>;
	requeueJobs(ids: string[]): Promise<RequeueResponse>;
	deleteJobs(ids: string[]): Promise<DeleteResponse>;
	createJob(options: CreateJobRequest): Promise<CreateJobResponse>;
	pauseJobs(ids: string[]): Promise<PauseResponse>;
	resumeJobs(ids: string[]): Promise<ResumeResponse>;
	createStateStream(onNotification: StateNotificationHandler): () => void;
	hasStateNotifications(): boolean;
}

export type { JobStateNotification, StateNotificationHandler };

/**
 * Factory type for creating Agendash middleware
 */
export type AgendashMiddlewareFactory<T> = (agenda: Agenda) => T;
