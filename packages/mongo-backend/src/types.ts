import type { Db, MongoClientOptions, SortDirection } from 'mongodb';

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

export type IMongoBackendConfig = MongoConnectionConfig & {
	/** Collection name for jobs (default: 'agendaJobs') */
	collection?: string;

	/** Name to set as lastModifiedBy on jobs */
	name?: string;

	/** Whether to create indexes on connect (default: false) */
	ensureIndex?: boolean;

	/** Sort order for job queries */
	sort?: { [key: string]: SortDirection };
};

/**
 * Database configuration options used internally by the repository
 */
export interface IMongoDbConfig {
	ensureIndex?: boolean;
	sort?: {
		[key: string]: SortDirection;
	};
}

/**
 * Configuration options for MongoJobRepository
 */
export type IMongoJobRepositoryConfig = IMongoDbConfig &
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
	) & {
		/** Name to set as lastModifiedBy on jobs */
		name?: string;
	};
