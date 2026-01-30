/**
 * Query parameters for the API
 */
export interface ApiQueryParams {
	name?: string;
	state?: string;
	search?: string;
	property?: string;
	isObjectId?: string;
	skip?: number;
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
	nextRunAt?: string | null;
	lastRunAt?: string | null;
	lastFinishedAt?: string | null;
	lockedAt?: string | null;
	failedAt?: string | null;
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
 * Response from requeue operation
 */
export interface RequeueResponse {
	requeuedCount: number;
}

/**
 * Response from delete operation
 */
export interface DeleteResponse {
	deleted: boolean;
	deletedCount?: number;
}

/**
 * Response from pause operation
 */
export interface PauseResponse {
	pausedCount: number;
}

/**
 * Response from resume operation
 */
export interface ResumeResponse {
	resumedCount: number;
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
 * Toast notification type
 */
export type ToastType = 'success' | 'error' | 'info';

/**
 * Toast notification
 */
export interface Toast {
	id: number;
	message: string;
	type: ToastType;
}

/**
 * Search form parameters
 */
export interface SearchParams {
	name: string;
	search: string;
	property: string;
	limit: number;
	skip: number;
	state: string;
	isObjectId: boolean;
}

/**
 * Job status in AgendaStats
 */
export interface AgendaJobStatus {
	[name: string]: {
		running: number;
		locked: number;
		config: {
			concurrency?: number;
			lockLimit?: number;
			lockLifetime?: number;
			priority?: number;
		};
	};
}

/**
 * Agenda running stats
 */
export interface AgendaStats {
	version: string;
	queueName: string | undefined;
	totalQueueSizeDB: number;
	config: {
		totalLockLimit: number;
		maxConcurrency: number;
		processEvery: string | number;
	};
	backend: {
		name: string;
		hasNotificationChannel: boolean;
	};
	internal: {
		localQueueProcessing: number;
	};
	jobStatus?: AgendaJobStatus;
	queuedJobs: number | unknown[];
	runningJobs: number | unknown[];
	lockedJobs: number | unknown[];
}

/**
 * Query parameters for the logs API
 */
export interface LogsQueryParams {
	jobId?: string;
	jobName?: string;
	level?: string;
	event?: string;
	from?: string;
	to?: string;
	limit?: number;
	offset?: number;
	sort?: 'asc' | 'desc';
}

/**
 * A log entry from the backend
 */
export interface FrontendLogEntry {
	_id?: string;
	timestamp: string;
	level: string;
	event: string;
	jobId?: string;
	jobName: string;
	message: string;
	duration?: number;
	error?: string;
	failCount?: number;
	retryDelay?: number;
	retryAttempt?: number;
	agendaName?: string;
	meta?: Record<string, unknown>;
}

/**
 * Response from the logs API
 */
export interface LogsResponse {
	entries: FrontendLogEntry[];
	total: number;
	loggingEnabled: boolean;
}

/**
 * Types of job state events
 */
export type JobStateType = 'start' | 'progress' | 'success' | 'fail' | 'complete' | 'retry';

/**
 * Job state notification received via SSE
 */
export interface JobStateNotification {
	type: JobStateType;
	jobId: string;
	jobName: string;
	timestamp: string;
	source?: string;
	progress?: number;
	error?: string;
	failCount?: number;
	retryAt?: string;
	retryAttempt?: number;
	duration?: number;
	lastRunAt?: string;
	lastFinishedAt?: string;
}
