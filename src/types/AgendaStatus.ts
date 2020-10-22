import type { Job } from '../Job';

export interface IAgendaJobStatus {
	[name: string]: { running: number; locked: number };
}

export interface IAgendaStatus {
	version: string;
	queueName: string | undefined;
	totalQueueSizeDB: number;
	config: {
		totalLockLimit: number;
		maxConcurrency: number;
		processEvery: string | number;
	};
	jobStatus?: IAgendaJobStatus;
	queuedJobs: number;
	runningJobs: number | Job[];
	lockedJobs: number | Job[];
	jobsToLock: number | Job[];
	isLockingOnTheFly: boolean;
}
