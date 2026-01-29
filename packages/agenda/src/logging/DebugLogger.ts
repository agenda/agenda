import debug from 'debug';
import type { Logger } from '../types/Logger.js';

/**
 * Logger implementation that wraps the `debug` library.
 * This is the default logger, preserving backward compatibility with the existing
 * `DEBUG=agenda:*` environment variable behavior.
 *
 * All log levels are routed through the `debug` library since it does not
 * differentiate between levels. Messages only appear when the `DEBUG` environment
 * variable includes the matching namespace.
 *
 * @example
 * ```typescript
 * import { Agenda, DebugLogger } from 'agenda';
 *
 * // Uses 'agenda' namespace by default
 * const agenda = new Agenda({
 *   backend,
 *   logger: new DebugLogger()
 * });
 *
 * // Custom namespace
 * const agenda = new Agenda({
 *   backend,
 *   logger: new DebugLogger('myapp:agenda')
 * });
 *
 * // Enable with: DEBUG=agenda:* node app.js
 * ```
 */
export class DebugLogger implements Logger {
	private readonly log: debug.Debugger;

	constructor(namespace = 'agenda') {
		this.log = debug(namespace);
	}

	info(message: string, ...meta: unknown[]): void {
		this.log(message, ...meta);
	}

	warn(message: string, ...meta: unknown[]): void {
		this.log(message, ...meta);
	}

	error(message: string, ...meta: unknown[]): void {
		this.log(message, ...meta);
	}

	debug(message: string, ...meta: unknown[]): void {
		this.log(message, ...meta);
	}
}
