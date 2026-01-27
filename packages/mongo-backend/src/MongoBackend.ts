import type { AgendaBackend, JobRepository, NotificationChannel } from 'agenda';
import { MongoJobRepository } from './MongoJobRepository.js';
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
 * const agenda = new Agenda({ backend });
 * ```
 */
export class MongoBackend implements AgendaBackend {
	readonly name = 'MongoDB';

	private _repository: MongoJobRepository;
	private _ownsConnection: boolean;

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
	}

	get repository(): JobRepository {
		return this._repository;
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
