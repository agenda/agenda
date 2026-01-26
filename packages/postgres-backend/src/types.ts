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
	created_at: Date;
	updated_at: Date;
}
