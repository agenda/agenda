/* eslint-disable no-console */
import type { Logger } from '../types/Logger.js';

/**
 * Logger implementation that writes to the console.
 * Messages are always visible (no environment variable filtering).
 *
 * Each log level maps to the corresponding `console` method:
 * - `info` → `console.info`
 * - `warn` → `console.warn`
 * - `error` → `console.error`
 * - `debug` → `console.debug`
 *
 * @example
 * ```typescript
 * import { Agenda, ConsoleLogger } from 'agenda';
 *
 * const agenda = new Agenda({
 *   backend,
 *   logger: new ConsoleLogger()
 * });
 * ```
 */
export class ConsoleLogger implements Logger {
	private readonly prefix: string;

	constructor(prefix = 'agenda') {
		this.prefix = prefix;
	}

	info(message: string, ...meta: unknown[]): void {
		console.info(`[${this.prefix}] ${message}`, ...meta);
	}

	warn(message: string, ...meta: unknown[]): void {
		console.warn(`[${this.prefix}] ${message}`, ...meta);
	}

	error(message: string, ...meta: unknown[]): void {
		console.error(`[${this.prefix}] ${message}`, ...meta);
	}

	debug(message: string, ...meta: unknown[]): void {
		console.debug(`[${this.prefix}] ${message}`, ...meta);
	}
}
