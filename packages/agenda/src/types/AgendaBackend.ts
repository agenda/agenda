import type { IJobRepository } from './JobRepository.js';
import type { INotificationChannel } from './NotificationChannel.js';

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
export interface IAgendaBackend {
	/**
	 * The job repository for storage operations.
	 * This is required - every backend must provide storage.
	 */
	readonly repository: IJobRepository;

	/**
	 * Optional notification channel for real-time job notifications.
	 * If provided, Agenda will use this for immediate job processing.
	 * If not provided, Agenda falls back to periodic polling.
	 */
	readonly notificationChannel?: INotificationChannel;

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
