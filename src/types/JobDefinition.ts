import { Job } from '../Job';

export interface IJobDefinition<DATA = any> {
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

	fn: DefinitionProcessor<DATA, void | ((err?) => void)>;
}

export type DefinitionProcessor<DATA, CB> = (
	agendaJob: Job<DATA>,
	done: CB
) => CB extends void ? Promise<void> : void;
