import type { Db, MongoClientOptions, SortDirection } from 'mongodb';

export interface IDatabaseOptions {
	db: {
		collection?: string;
		address: string;
		options?: MongoClientOptions;
	};
}

export interface IMongoOptions {
	db?: {
		collection?: string;
	};
	mongo: Db;
}

export interface IDbConfig {
	ensureIndex?: boolean;
	sort?: {
		[key: string]: SortDirection;
	};
}
