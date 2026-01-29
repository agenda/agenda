import type { Pool, PoolConfig } from 'pg';
import type { SortDirection } from 'agenda';

/**
 * Configuration options for PostgresBackend
 */
export interface PostgresBackendConfig {
	/** PostgreSQL connection string (e.g., 'postgresql://user:pass@host:5432/db') */
	connectionString?: string;

	/** PostgreSQL pool configuration (creates a new pool) */
	poolConfig?: PoolConfig;

	/** Existing PostgreSQL pool instance (will not be closed on disconnect) */
	pool?: Pool;

	/** Table name for jobs (default: 'agenda_jobs') */
	tableName?: string;

	/** Channel name for LISTEN/NOTIFY (default: 'agenda_jobs') */
	channelName?: string;

	/** Whether to create the table and indexes on connect (default: true) */
	ensureSchema?: boolean;

	/** Sort order for job queries (default: { nextRunAt: 'asc', priority: 'desc' }) */
	sort?: {
		nextRunAt?: SortDirection;
		priority?: SortDirection;
	};

	/** Disable LISTEN/NOTIFY notification channel (default: false) */
	disableNotifications?: boolean;

	/**
	 * Enable persistent job event logging.
	 * When true, creates a PostgreSQL table (default: 'agenda_logs') to store job lifecycle events.
	 * @default false
	 */
	logging?: boolean;

	/** Table name for log entries (default: 'agenda_logs'). Only used when `logging: true`. */
	logTableName?: string;
}

/**
 * Internal row type matching PostgreSQL column names
 */
export interface PostgresJobRow {
	id: string;
	name: string;
	priority: number;
	next_run_at: Date | null;
	type: 'normal' | 'single';
	locked_at: Date | null;
	last_finished_at: Date | null;
	failed_at: Date | null;
	fail_count: number | null;
	fail_reason: string | null;
	repeat_timezone: string | null;
	last_run_at: Date | null;
	repeat_interval: string | null;
	data: unknown;
	repeat_at: string | null;
	disabled: boolean;
	progress: number | null;
	fork: boolean;
	last_modified_by: string | null;
	debounce_started_at: Date | null;
	created_at: Date;
	updated_at: Date;
}
