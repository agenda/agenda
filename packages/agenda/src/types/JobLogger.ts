/**
 * Log level for job event entries.
 */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

/**
 * Job lifecycle events that are logged.
 */
export type JobLogEvent =
	| 'start'
	| 'success'
	| 'fail'
	| 'complete'
	| 'retry'
	| 'retry:exhausted'
	| 'locked'
	| 'expired';

/**
 * A structured log entry for a job lifecycle event.
 */
export interface JobLogEntry {
	/** Unique identifier (assigned by the storage backend) */
	_id?: string;

	/** When the event occurred */
	timestamp: Date;

	/** Log severity level */
	level: LogLevel;

	/** The lifecycle event type */
	event: JobLogEvent;

	/** The job ID (if applicable) */
	jobId?: string;

	/** The job name */
	jobName: string;

	/** Human-readable message describing the event */
	message: string;

	/** Duration of execution in milliseconds (for success/complete events) */
	duration?: number;

	/** Error message (for fail events) */
	error?: string;

	/** Number of failures (for fail/retry events) */
	failCount?: number;

	/** Delay before the next retry in milliseconds (for retry events) */
	retryDelay?: number;

	/** The retry attempt number (for retry events) */
	retryAttempt?: number;

	/** The name of the Agenda instance that logged this event */
	agendaName?: string;

	/** Additional metadata */
	meta?: Record<string, unknown>;
}

/**
 * Query options for retrieving log entries.
 */
export interface JobLogQuery {
	/** Filter by job ID */
	jobId?: string;

	/** Filter by job name */
	jobName?: string;

	/** Filter by log level(s) */
	level?: LogLevel | LogLevel[];

	/** Filter by event type(s) */
	event?: JobLogEvent | JobLogEvent[];

	/** Filter entries from this date (inclusive) */
	from?: Date;

	/** Filter entries up to this date (inclusive) */
	to?: Date;

	/** Maximum number of entries to return (default: 50) */
	limit?: number;

	/** Number of entries to skip for pagination */
	offset?: number;

	/** Sort direction by timestamp (default: 'desc') */
	sort?: 'asc' | 'desc';
}

/**
 * Result of a log query including entries and total count (for pagination).
 */
export interface JobLogQueryResult {
	/** The log entries matching the query */
	entries: JobLogEntry[];

	/** Total number of entries matching the query (ignoring limit/offset) */
	total: number;
}

/**
 * Pluggable interface for persistent job event logging.
 *
 * Implement this interface to store job lifecycle logs in your preferred backend.
 * Each backend package (mongo, postgres, redis) provides a built-in implementation
 * that stores logs in a dedicated table/collection alongside the jobs.
 *
 * @example
 * ```typescript
 * // Enable backend's built-in logger
 * const agenda = new Agenda({
 *   backend: new PostgresBackend({ connectionString: '...', logging: true }),
 *   logging: true
 * });
 *
 * // Query logs
 * const result = await agenda.getLogs({ jobName: 'myJob', limit: 100 });
 * ```
 */
export interface JobLogger {
	/**
	 * Write a log entry.
	 * Called automatically by Agenda for each job lifecycle event.
	 * Implementations should be fast and non-blocking.
	 */
	log(entry: Omit<JobLogEntry, '_id'>): Promise<void>;

	/**
	 * Query log entries with optional filtering and pagination.
	 * Used by agendash to display logs.
	 */
	getLogs(query?: JobLogQuery): Promise<JobLogQueryResult>;

	/**
	 * Delete log entries matching the query.
	 * If no query is provided, deletes ALL log entries.
	 * Returns the number of deleted entries.
	 */
	clearLogs(query?: JobLogQuery): Promise<number>;
}
