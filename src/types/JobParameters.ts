/* eslint-disable @typescript-eslint/no-explicit-any */
import { FilterQuery, ObjectId } from 'mongodb';

export interface IJobParameters<DATA = unknown | void> {
	_id?: ObjectId;

	name: string;
	priority: number;
	nextRunAt: Date | null;
	/**
	 * normal: job is queued and will be processed (regular case when the user adds a new job)
	 * single: job with this name is only queued once, if there is an exisitn gentry in the database, the job is just updated, but not newly inserted (this is used for .every())
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

	// unique query object
	unique?: FilterQuery<IJobParameters<DATA>>;
	uniqueOpts?: {
		insertOnly: boolean;
	};

	lastModifiedBy?: string;
}
