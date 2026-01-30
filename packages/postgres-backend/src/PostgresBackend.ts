import debug from 'debug';
import type { AgendaBackend, JobRepository, NotificationChannel, JobLogger } from 'agenda';
import { PostgresJobRepository } from './PostgresJobRepository.js';
import { PostgresJobLogger } from './PostgresJobLogger.js';
import { PostgresNotificationChannel } from './PostgresNotificationChannel.js';
import type { PostgresBackendConfig } from './types.js';

const log = debug('agenda:postgres:backend');

/**
 * PostgreSQL backend for Agenda
 *
 * Provides both storage (via PostgresJobRepository) and real-time notifications
 * (via PostgresNotificationChannel using LISTEN/NOTIFY).
 *
 * @example
 * ```typescript
 * import { Agenda } from 'agenda';
 * import { PostgresBackend } from '@agendajs/postgres-backend';
 *
 * // Using connection string
 * const agenda = new Agenda({
 *   backend: new PostgresBackend({
 *     connectionString: 'postgresql://user:pass@localhost:5432/mydb'
 *   })
 * });
 *
 * // Or using an existing pool (e.g., shared with your app)
 * // The pool will NOT be closed when Agenda disconnects
 * import { Pool } from 'pg';
 * const pool = new Pool({ connectionString: '...' });
 *
 * const agenda = new Agenda({
 *   backend: new PostgresBackend({ pool })
 * });
 *
 * // Your app can continue using the pool after agenda.stop()
 *
 * agenda.define('myJob', async (job) => {
 *   console.log('Running job:', job.attrs.name);
 * });
 *
 * await agenda.start();
 * await agenda.every('5 minutes', 'myJob');
 * ```
 */
export class PostgresBackend implements AgendaBackend {
	readonly name = 'PostgreSQL';

	private _repository: PostgresJobRepository;
	private _notificationChannel?: PostgresNotificationChannel;
	private _logger?: PostgresJobLogger;
	private config: PostgresBackendConfig;
	private _ownsConnection: boolean;

	constructor(config: PostgresBackendConfig) {
		this.config = config;

		// Determine if we own the connection (not passed in by user)
		this._ownsConnection = !config.pool;

		// Create repository
		this._repository = new PostgresJobRepository(config);

		// Create notification channel (unless disabled)
		if (!config.disableNotifications) {
			this._notificationChannel = new PostgresNotificationChannel({
				channelName: config.channelName,
				reconnect: {
					enabled: true
				}
			});
		}

		// Create job logger if logging is enabled
		if (config.logging) {
			this._logger = new PostgresJobLogger({
				tableName: config.logTableName,
				ensureSchema: config.ensureSchema
			});
		}

		log('PostgresBackend created with config: %O', {
			tableName: config.tableName || 'agenda_jobs',
			channelName: config.channelName || 'agenda_jobs',
			ensureSchema: config.ensureSchema ?? true,
			disableNotifications: config.disableNotifications ?? false,
			logging: config.logging ?? false,
			ownsConnection: this._ownsConnection
		});
	}

	/**
	 * The job repository for storage operations
	 */
	get repository(): JobRepository {
		return this._repository;
	}

	/**
	 * Whether this backend owns its database connection.
	 * True if created from connectionString/poolConfig, false if pool was passed in.
	 */
	get ownsConnection(): boolean {
		return this._ownsConnection;
	}

	/**
	 * The job logger for persistent event logging.
	 * Only available when `logging: true` is set in config.
	 */
	get logger(): JobLogger | undefined {
		return this._logger;
	}

	/**
	 * The notification channel for real-time notifications via LISTEN/NOTIFY
	 * Returns undefined if notifications are disabled
	 */
	get notificationChannel(): NotificationChannel | undefined {
		return this._notificationChannel;
	}

	/**
	 * Connect to PostgreSQL
	 *
	 * - Establishes database connection pool
	 * - Creates table and indexes if ensureSchema is true
	 * - Sets up LISTEN for real-time notifications
	 */
	async connect(): Promise<void> {
		log('connecting PostgresBackend');

		// Connect repository first (creates pool and schema)
		await this._repository.connect();

		// Share the pool with notification channel (if enabled)
		if (this._notificationChannel) {
			this._notificationChannel.setPool(this._repository.getPool());
		}

		// Initialize the job logger with the shared pool
		if (this._logger) {
			await this._logger.setPool(this._repository.getPool());
		}

		// Note: notification channel is connected by Agenda.start()
		// when it's needed, so we don't connect it here

		log('PostgresBackend connected');
	}

	/**
	 * Disconnect from PostgreSQL
	 *
	 * - Stops LISTEN on notification channel
	 * - Closes database connection pool
	 */
	async disconnect(): Promise<void> {
		log('disconnecting PostgresBackend');

		// Notification channel is disconnected by Agenda.stop()
		// Repository disconnect will close the shared pool
		await this._repository.disconnect();

		log('PostgresBackend disconnected');
	}
}
