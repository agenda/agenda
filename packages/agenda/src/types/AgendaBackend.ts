import type { JobRepository } from './JobRepository.js';
import type { NotificationChannel } from './NotificationChannel.js';
import type { JobLogger } from './JobLogger.js';

/**
 * Unified backend interface for Agenda.
 *
 * A backend provides storage (required) and optionally notifications.
 * This allows a single driver to implement both capabilities (e.g., PostgreSQL with LISTEN/NOTIFY)
 * or just storage (e.g., MongoDB without notifications).
 *
 * Examples:
 * - MongoBackend: provides repository only (polling-based)
 * - PostgresBackend: provides repository + notificationChannel (LISTEN/NOTIFY)
 * - Custom: mix storage from one system, notifications from another
 */
export interface AgendaBackend {
	/**
	 * Human-readable name for this backend (e.g., 'MongoDB', 'PostgreSQL', 'Redis').
	 * Used for display in dashboards and debugging.
	 */
	readonly name: string;

	/**
	 * The job repository for storage operations.
	 * This is required - every backend must provide storage.
	 */
	readonly repository: JobRepository;

	/**
	 * Optional notification channel for real-time job notifications.
	 * If provided, Agenda will use this for immediate job processing.
	 * If not provided, Agenda falls back to periodic polling.
	 */
	readonly notificationChannel?: NotificationChannel;

	/**
	 * Job logger for persistent job event logging.
	 * Backends provide a logger that stores events in a dedicated table/collection.
	 * The logger is lightweight and only initializes its storage on first use.
	 * Agenda activates this logger when the user enables logging via `logging: true`.
	 */
	readonly logger?: JobLogger;

	/**
	 * Whether the backend owns its database connection.
	 * - true: backend created the connection (e.g., from connection string)
	 * - false: connection was passed in by the user
	 *
	 * Used by agenda.stop() to determine whether to close the connection.
	 * Defaults to true if not implemented.
	 */
	readonly ownsConnection?: boolean;

	/**
	 * Connect to the backend.
	 * Called when agenda.start() is invoked.
	 * Should establish database connections, set up notification subscriptions, etc.
	 */
	connect(): Promise<void>;

	/**
	 * Disconnect from the backend.
	 * Called when agenda.stop() is invoked.
	 * Should clean up connections, unsubscribe from notifications, etc.
	 */
	disconnect(): Promise<void>;
}
