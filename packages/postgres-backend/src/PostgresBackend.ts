import debug from 'debug';
import type { IAgendaBackend, IJobRepository, INotificationChannel } from 'agenda';
import { PostgresJobRepository } from './PostgresJobRepository.js';
import { PostgresNotificationChannel } from './PostgresNotificationChannel.js';
import type { IPostgresBackendConfig } from './types.js';

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
 * import { PostgresBackend } from '@agenda.js/postgres-backend';
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
export class PostgresBackend implements IAgendaBackend {
	private _repository: PostgresJobRepository;
	private _notificationChannel: PostgresNotificationChannel;
	private config: IPostgresBackendConfig;

	constructor(config: IPostgresBackendConfig) {
		this.config = config;

		// Create repository
		this._repository = new PostgresJobRepository(config);

		// Create notification channel
		this._notificationChannel = new PostgresNotificationChannel({
			channelName: config.channelName,
			reconnect: {
				enabled: true
			}
		});

		log('PostgresBackend created with config: %O', {
			tableName: config.tableName || 'agenda_jobs',
			channelName: config.channelName || 'agenda_jobs',
			ensureSchema: config.ensureSchema ?? true
		});
	}

	/**
	 * The job repository for storage operations
	 */
	get repository(): IJobRepository {
		return this._repository;
	}

	/**
	 * The notification channel for real-time notifications via LISTEN/NOTIFY
	 */
	get notificationChannel(): INotificationChannel {
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

		// Share the pool with notification channel
		this._notificationChannel.setPool(this._repository.getPool());

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
