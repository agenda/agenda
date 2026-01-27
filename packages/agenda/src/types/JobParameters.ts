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

/**
 * Options for debouncing job execution.
 * Debouncing delays job execution and resets the timer on subsequent saves,
 * ensuring the job only runs once after a quiet period.
 */
export interface DebounceOptions {
	/**
	 * Debounce window in milliseconds.
	 * The job will be scheduled to run this many ms after the last save.
	 */
	delay: number;

	/**
	 * Maximum time to wait before forcing execution (in milliseconds).
	 * If set, the job will execute within maxWait even if new saves keep coming.
	 * Without maxWait, continuous saves could delay execution indefinitely.
	 */
	maxWait?: number;

	/**
	 * Debounce strategy:
	 * - 'trailing' (default): Execute after quiet period ends (last call wins)
	 * - 'leading': Execute immediately on first call, ignore subsequent calls during window
	 */
	strategy?: 'trailing' | 'leading';
}

/**
 * Options for unique constraint behavior during job save.
 */
export interface UniqueOpts {
	/**
	 * If true, only insert if no matching job exists.
	 * Existing jobs are returned unchanged.
	 */
	insertOnly?: boolean;

	/**
	 * Debounce options for combining rapid job saves.
	 * Requires a unique constraint to be set.
	 */
	debounce?: DebounceOptions;
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
	uniqueOpts?: UniqueOpts;

	/**
	 * Tracks when debounce window started.
	 * Used internally for maxWait calculations.
	 */
	debounceStartedAt?: Date;

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
	'lastRunAt' | 'lastFinishedAt' | 'nextRunAt' | 'failedAt' | 'lockedAt' | 'startDate' | 'endDate' | 'debounceStartedAt'
>;

export const datefields: Array<TJobDatefield> = [
	'lastRunAt',
	'lastFinishedAt',
	'nextRunAt',
	'failedAt',
	'lockedAt',
	'startDate',
	'endDate',
	'debounceStartedAt'
];
