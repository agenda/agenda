import type { Logger } from '../types/Logger.js';

/**
 * Logger implementation that discards all messages.
 * Use this to completely disable Agenda's logging output.
 *
 * @example
 * ```typescript
 * import { Agenda, NoopLogger } from 'agenda';
 *
 * const agenda = new Agenda({
 *   backend,
 *   logger: new NoopLogger()
 * });
 *
 * // Or simply pass false:
 * const agenda = new Agenda({
 *   backend,
 *   logger: false
 * });
 * ```
 */
export class NoopLogger implements Logger {
	info(): void {}
	warn(): void {}
	error(): void {}
	debug(): void {}
}
