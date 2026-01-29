import type { Db, MongoClientOptions } from 'mongodb';
import type { SortDirection } from 'agenda';

/**
 * Configuration options for MongoBackend
 */

export type MongoConnectionConfig =
	| {
			/** Existing MongoDB database instance */
			mongo: Db;
	  }
	| {
			/** MongoDB connection string */
			address: string;

			/** MongoDB client options */
			options?: MongoClientOptions;
	  };

export type MongoBackendConfig = MongoConnectionConfig & {
	/** Collection name for jobs (default: 'agendaJobs') */
	collection?: string;

	/** Whether to create indexes on connect (default: true) */
	ensureIndex?: boolean;

	/** Sort order for job queries */
	sort?: { [key: string]: SortDirection };

	/**
	 * Enable persistent job event logging.
	 * When true, creates a MongoDB collection (default: 'agenda_logs') to store job lifecycle events.
	 * @default false
	 */
	logging?: boolean;

	/** Collection name for log entries (default: 'agenda_logs'). Only used when `logging: true`. */
	logCollection?: string;
};

/**
 * Database configuration options used internally by the repository
 */
export interface MongoDbConfig {
	ensureIndex?: boolean;
	sort?: {
		[key: string]: SortDirection;
	};
}

/**
 * Configuration options for MongoJobRepository
 */
export type MongoJobRepositoryConfig = MongoDbConfig &
	(
		| {
				/** MongoDB connection string */
				db: { address: string; collection?: string; options?: MongoClientOptions };
		  }
		| {
				/** Existing MongoDB database instance */
				mongo: Db;
				db?: { collection?: string };
		  }
	);
