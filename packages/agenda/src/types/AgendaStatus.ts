import type { JobParameters } from './JobParameters.js';
import type { JobDefinition } from './JobDefinition.js';

export interface AgendaJobStatus {
	[name: string]: {
		running: number;
		locked: number;
		config: JobDefinition;
	};
}

export interface AgendaStatus {
	version: string;
	queueName: string | undefined;
	totalQueueSizeDB: number;
	config: {
		totalLockLimit: number;
		maxConcurrency: number;
		processEvery: string | number;
	};
	backend: {
		/** Backend name (e.g., 'MongoDB', 'PostgreSQL', 'Redis') */
		name: string;
		/** Whether a notification channel is configured for real-time processing */
		hasNotificationChannel: boolean;
	};
	internal: {
		localQueueProcessing: number;
	};
	jobStatus?: AgendaJobStatus;
	queuedJobs: number | JobParameters[];
	runningJobs: number | JobParameters[];
	lockedJobs: number | JobParameters[];
}
