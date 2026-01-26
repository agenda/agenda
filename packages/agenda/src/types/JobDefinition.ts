import type { Job } from '../Job.js';
import type { BackoffStrategy } from '../utils/backoff.js';

export interface JobDefinition<DATA = unknown> {
	/** max number of locked jobs of this kind */
	lockLimit: number;
	/** lock lifetime in milliseconds */
	lockLifetime: number;
	/** Higher priority jobs will run first. */
	priority?: number;
	/** how many jobs of this kind can run in parallel/simultanously per Agenda instance */
	concurrency?: number;

	/**
	 * Backoff strategy for automatic retries on failure.
	 * Can be a built-in strategy from `backoffStrategies` or a custom function.
	 *
	 * @example
	 * ```ts
	 * import { backoffStrategies } from 'agenda';
	 *
	 * // Using built-in exponential backoff
	 * agenda.define('myJob', handler, {
	 *   backoff: backoffStrategies.exponential({ delay: 1000, maxRetries: 5 })
	 * });
	 *
	 * // Using a preset
	 * agenda.define('myJob', handler, {
	 *   backoff: backoffStrategies.standard()
	 * });
	 *
	 * // Custom strategy
	 * agenda.define('myJob', handler, {
	 *   backoff: (ctx) => ctx.attempt <= 3 ? 1000 * ctx.attempt : null
	 * });
	 * ```
	 */
	backoff?: BackoffStrategy;

	filePath: string | undefined;
	fn: DefinitionProcessor<DATA, void | ((error?: Error) => void)>;
}

export type DefinitionProcessor<DATA, CB> = (
	agendaJob: Job<DATA>,
	done: CB
) => CB extends void ? Promise<void> : void;
