import { Job } from '../Job';

export interface IAgendaStatus {
	version: string;
	queueName: string | undefined;
	totalQueueSizeDB: number;
	config: {
		totalLockLimit: number;
		maxConcurrency: number;
		processEvery: string | number;
	};
	jobStatus: { [name: string]: { running: number; locked: number } | undefined };
	queuedJobs: number;
	runningJobs: number | Job[];
	lockedJobs: number | Job[];
	jobsToLock: number | Job[];
	isLockingOnTheFly: boolean;
}
