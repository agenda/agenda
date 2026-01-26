/**
 * Branded type for job IDs.
 * At runtime it's a string, but TypeScript treats it as a distinct type.
 */
export type JobId = string & { readonly __brand: 'AgendaJobId' };

/**
 * Create a JobId from a string
 */
export function toJobId(id: string): JobId {
	return id as JobId;
}

export interface JobParameters<DATA = unknown | void> {
	/** Job ID */
	_id?: JobId;

	name: string;
	priority: number;
	nextRunAt: Date | null;
	/**
	 * normal: job is queued and will be processed (regular case when the user adds a new job)
	 * single: job with this name is only queued once, if there is an existing entry in the database, the job is just updated, but not newly inserted (this is used for .every())
	 */
	type: 'normal' | 'single';

	lockedAt?: Date;
	lastFinishedAt?: Date;
	failedAt?: Date;
	failCount?: number;
	failReason?: string;
	repeatTimezone?: string;
	lastRunAt?: Date;
	repeatInterval?: string | number;
	data: DATA;
	repeatAt?: string;
	disabled?: boolean;
	progress?: number;

	/**
	 * Unique constraint query object.
	 * Keys are field paths (e.g., 'data.userId'), values are the expected values.
	 * The implementation interprets this for upsert operations.
	 */
	unique?: Record<string, unknown>;
	uniqueOpts?: {
		insertOnly: boolean;
	};

	lastModifiedBy?: string;

	/** Forks a new node sub process for executing this job */
	fork?: boolean;

	/**
	 * The date when the job should start running.
	 * The job will not run before this date.
	 */
	startDate?: Date;

	/**
	 * The date when the job should stop running.
	 * The job will not run after this date (nextRunAt will be set to null).
	 */
	endDate?: Date;

	/**
	 * Days of the week to skip (0 = Sunday, 1 = Monday, ..., 6 = Saturday).
	 * The job will not run on these days.
	 */
	skipDays?: number[];
}

export type TJobDatefield = keyof Pick<
	JobParameters,
	'lastRunAt' | 'lastFinishedAt' | 'nextRunAt' | 'failedAt' | 'lockedAt' | 'startDate' | 'endDate'
>;

export const datefields: Array<TJobDatefield> = [
	'lastRunAt',
	'lastFinishedAt',
	'nextRunAt',
	'failedAt',
	'lockedAt',
	'startDate',
	'endDate'
];
