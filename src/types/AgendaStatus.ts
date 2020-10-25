import type { IJobParameters } from './JobParameters';
import type { IJobDefinition } from './JobDefinition';

export interface IAgendaJobStatus {
	[name: string]: {
		running: number;
		locked: number;
		config: IJobDefinition;
	};
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
	internal: {
		localQueueProcessing: number;
	};
	jobStatus?: IAgendaJobStatus;
	queuedJobs: number | IJobParameters[];
	runningJobs: number | IJobParameters[];
	lockedJobs: number | IJobParameters[];
	jobsToLock: number | IJobParameters[];
	isLockingOnTheFly: boolean;
}
