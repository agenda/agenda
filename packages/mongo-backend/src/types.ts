import type { Db, MongoClientOptions, SortDirection } from 'mongodb';

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
export interface IMongoJobRepositoryConfig extends IMongoDbConfig {
	/** MongoDB connection string */
	db?: { address: string; collection?: string; options?: MongoClientOptions };
	/** Existing MongoDB database instance */
	mongo?: Db;
	/** Name to set as lastModifiedBy on jobs */
	name?: string;
}
