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
	internal: {
		localQueueProcessing: number;
	};
	jobStatus?: AgendaJobStatus;
	queuedJobs: number | unknown[];
	runningJobs: number | unknown[];
	lockedJobs: number | unknown[];
}
