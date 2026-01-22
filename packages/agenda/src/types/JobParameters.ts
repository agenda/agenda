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

export interface IJobParameters<DATA = unknown | void> {
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
}

export type TJobDatefield = keyof Pick<
	IJobParameters,
	'lastRunAt' | 'lastFinishedAt' | 'nextRunAt' | 'failedAt' | 'lockedAt'
>;

export const datefields: Array<TJobDatefield> = [
	'lastRunAt',
	'lastFinishedAt',
	'nextRunAt',
	'failedAt',
	'lockedAt'
];
