import type { IAgendaBackend, IJobRepository, INotificationChannel } from 'agenda';
import { MongoJobRepository } from './MongoJobRepository.js';
import type { IMongoBackendConfig } from './types.js';

/**
 * MongoDB backend for Agenda.
 * Provides storage via MongoDB. Does not provide notifications (uses polling).
 *
 * @example
 * ```typescript
 * import { Agenda } from 'agenda';
 * import { MongoBackend } from '@agenda.js/mongo-backend';
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
export class MongoBackend implements IAgendaBackend {
	private _repository: MongoJobRepository;

	/**
	 * MongoDB does not provide a notification channel.
	 * For real-time notifications with MongoDB, use a separate notification
	 * channel like Redis pub/sub.
	 */
	readonly notificationChannel: INotificationChannel | undefined = undefined;

	constructor(private config: IMongoBackendConfig) {
		this._repository = new MongoJobRepository({
			db: config.address
				? { address: config.address, collection: config.collection, options: config.options }
				: undefined,
			mongo: config.mongo,
			name: config.name,
			ensureIndex: config.ensureIndex,
			sort: config.sort
		});
	}

	get repository(): IJobRepository {
		return this._repository;
	}

	/**
	 * Connect to MongoDB and initialize the collection.
	 */
	async connect(): Promise<void> {
		await this._repository.connect();
	}

	/**
	 * Disconnect from MongoDB.
	 * Note: If using an existing Db instance, this does not close the connection.
	 */
	async disconnect(): Promise<void> {
		// MongoJobRepository doesn't currently have a disconnect method
		// For passed-in connections, we don't own the lifecycle
		// For connection string connections, we could add cleanup if needed
	}
}
