import { ObjectId } from 'mongodb';

export interface IJobParameters {
	_id?: ObjectId;

	name: string;
	priority: number;
	nextRunAt: Date | null;
	/**
	 * // once: the job is just queued in the database --> this does not really exists, it's just  fallback
	 * normal: job is queued and will be processed (regular case when the user adds a new job)
	 * single: job with this name is only queued once, if there is an exisitn gentry in the database, the job is just updated, but not newly inserted (this is used for .every())
	 */
	type: /* 'once' | */ 'normal' | 'single';

	lockedAt?: Date;
	lastFinishedAt?: Date;
	failedAt?: Date;
	failCount?: number;
	failReason?: string;
	repeatTimezone?: string;
	lastRunAt?: Date;
	repeatInterval?: string | number;
	data?: any;
	repeatAt?: string;
	disabled?: boolean;
	progress?: number;

	// unique query object
	unique?: any;
	uniqueOpts?: {
		insertOnly: boolean;
	};

	lastModifiedBy?: string;
}
