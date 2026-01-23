import type { Db, MongoClientOptions, SortDirection } from 'mongodb';
import { JobDbRepository } from '../JobDbRepository.js';
import type { IAgendaBackend } from '../types/AgendaBackend.js';
import type { IJobRepository } from '../types/JobRepository.js';
import type { INotificationChannel } from '../types/NotificationChannel.js';

/**
 * Configuration options for MongoBackend
 */
export interface IMongoBackendConfig {
	/** MongoDB connection string */
	address?: string;

	/** Existing MongoDB database instance */
	mongo?: Db;

	/** Collection name for jobs (default: 'agendaJobs') */
	collection?: string;

	/** MongoDB client options */
	options?: MongoClientOptions;

	/** Name to set as lastModifiedBy on jobs */
	name?: string;

	/** Whether to create indexes on connect (default: false) */
	ensureIndex?: boolean;

	/** Sort order for job queries */
	sort?: { [key: string]: SortDirection };
}

/**
 * MongoDB backend for Agenda.
 * Provides storage via MongoDB. Does not provide notifications (uses polling).
 *
 * @example
 * ```typescript
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
	private _repository: JobDbRepository;

	/**
	 * MongoDB does not provide a notification channel.
	 * For real-time notifications with MongoDB, use a separate notification
	 * channel like Redis pub/sub.
	 */
	readonly notificationChannel: INotificationChannel | undefined = undefined;

	constructor(private config: IMongoBackendConfig) {
		this._repository = new JobDbRepository({
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
		// JobDbRepository doesn't currently have a disconnect method
		// For passed-in connections, we don't own the lifecycle
		// For connection string connections, we could add cleanup if needed
	}
}
