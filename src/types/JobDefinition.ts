import type { Job } from '../Job';

export interface IJobDefinition<DATA = unknown> {
	/** max number of locked jobs of this kind */
	lockLimit: number;
	/** lock lifetime in milliseconds */
	lockLifetime: number;
	/** Higher priority jobs will run first. */
	priority?: number;
	/** how many jobs of this kind can run in parallel/simultanously per Agenda instance */
	concurrency?: number;

	filePath: string | undefined;
	fn: DefinitionProcessor<DATA, void | ((error?: Error) => void)>;
}

export type DefinitionProcessor<DATA, CB> = (
	agendaJob: Job<DATA>,
	done: CB
) => CB extends void ? Promise<void> : void;
