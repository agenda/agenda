/**
 * Log level for the Agenda logger.
 */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

/**
 * Pluggable logger interface for Agenda.
 *
 * Implement this interface to integrate with any logging library
 * (e.g., winston, pino, bunyan, or a custom solution).
 *
 * The logger is used to log job lifecycle events (start, success, fail, complete, retry, etc.)
 * and key Agenda operations (start, stop, drain).
 *
 * @example
 * ```typescript
 * // Use with winston
 * import winston from 'winston';
 *
 * const winstonLogger = winston.createLogger({ ... });
 *
 * const agenda = new Agenda({
 *   backend: new MongoBackend({ mongo: db }),
 *   logger: {
 *     info: (msg, ...args) => winstonLogger.info(msg, ...args),
 *     warn: (msg, ...args) => winstonLogger.warn(msg, ...args),
 *     error: (msg, ...args) => winstonLogger.error(msg, ...args),
 *     debug: (msg, ...args) => winstonLogger.debug(msg, ...args),
 *   }
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Use with pino
 * import pino from 'pino';
 *
 * const pinoLogger = pino();
 *
 * const agenda = new Agenda({
 *   backend: new MongoBackend({ mongo: db }),
 *   logger: {
 *     info: (msg, ...args) => pinoLogger.info({ args }, msg),
 *     warn: (msg, ...args) => pinoLogger.warn({ args }, msg),
 *     error: (msg, ...args) => pinoLogger.error({ args }, msg),
 *     debug: (msg, ...args) => pinoLogger.debug({ args }, msg),
 *   }
 * });
 * ```
 */
export interface Logger {
	/**
	 * Log an informational message.
	 * Used for job lifecycle events (started, succeeded, completed) and Agenda operations.
	 */
	info(message: string, ...meta: unknown[]): void;

	/**
	 * Log a warning message.
	 * Used for retry exhaustion, deprecated usage, and other warnings.
	 */
	warn(message: string, ...meta: unknown[]): void;

	/**
	 * Log an error message.
	 * Used for job failures, processing errors, and system errors.
	 */
	error(message: string, ...meta: unknown[]): void;

	/**
	 * Log a debug message.
	 * Used for detailed internal operations (locking, queue filling, scheduling).
	 */
	debug(message: string, ...meta: unknown[]): void;
}
