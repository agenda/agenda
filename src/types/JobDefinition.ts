import { Job } from '../Job';

export interface IJobDefinition {
	/** max number of locked jobs of this kind */
	lockLimit: number;
	/** lock lifetime in milliseconds */
	lockLifetime: number;
	/** Higher priority jobs will run first. */
	priority?: number;
	/** how many jobs of this kind can run in parallel/simultanously */
	concurrency?: number;

	// running: number;
	// locked: number;

	fn: (agendaJob: Job, done?: (err?) => void) => Promise<void> | void;
}
