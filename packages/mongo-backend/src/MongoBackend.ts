import type { AgendaBackend, JobRepository, NotificationChannel, JobLogger } from 'agenda';
import { MongoJobRepository } from './MongoJobRepository.js';
import { MongoJobLogger } from './MongoJobLogger.js';
import type { MongoBackendConfig } from './types.js';

/**
 * MongoDB backend for Agenda.
 * Provides storage via MongoDB. Does not provide notifications (uses polling).
 *
 * @example
 * ```typescript
 * import { Agenda } from 'agenda';
 * import { MongoBackend } from '@agendajs/mongo-backend';
 *
 * // Via connection string
 * const backend = new MongoBackend({ address: 'mongodb://localhost/agenda' });
 *
 * // Via existing connection
 * const backend = new MongoBackend({ mongo: existingDb });
 *
 * // With persistent job event logging
 * const backend = new MongoBackend({ mongo: existingDb, logging: true });
 *
 * const agenda = new Agenda({ backend, logging: true });
 * ```
 */
export class MongoBackend implements AgendaBackend {
	readonly name = 'MongoDB';

	private _repository: MongoJobRepository;
	private _ownsConnection: boolean;
	private _logger: MongoJobLogger;

	/**
	 * MongoDB does not provide a notification channel.
	 * For real-time notifications with MongoDB, use a separate notification
	 * channel like Redis pub/sub.
	 */
	readonly notificationChannel: NotificationChannel | undefined = undefined;

	constructor(private config: MongoBackendConfig) {
		// Determine if we own the connection (not passed in by user)
		this._ownsConnection = !('mongo' in config);
		this._repository = new MongoJobRepository({
			...('mongo' in config
				? { mongo: config.mongo, db: { collection: config.collection } }
				: {
						db: { address: config.address, collection: config.collection, options: config.options }
					}),
			ensureIndex: config.ensureIndex,
			sort: config.sort
		});

		// Always create the logger (lightweight; only initializes on first use when Agenda activates it)
		this._logger = new MongoJobLogger(config.logCollection);
	}

	get repository(): JobRepository {
		return this._repository;
	}

	/**
	 * The job logger for persistent event logging.
	 * Always available; Agenda decides whether to activate it via its `logging` config.
	 */
	get logger(): JobLogger {
		return this._logger;
	}

	/**
	 * Whether this backend owns its database connection.
	 * True if created from address (connection string), false if mongo Db was passed in.
	 */
	get ownsConnection(): boolean {
		return this._ownsConnection;
	}

	/**
	 * Connect to MongoDB and initialize the collection.
	 */
	async connect(): Promise<void> {
		await this._repository.connect();

		// Initialize the job logger with the shared database connection
		await this._logger.setDb(this._repository.getDb());
	}

	/**
	 * Disconnect from MongoDB.
	 * Only closes the connection if we created it (i.e., from connection string).
	 * If an existing Db instance was passed in, this is a no-op.
	 */
	async disconnect(): Promise<void> {
		await this._repository.disconnect();
	}
}
