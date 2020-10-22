import type { Db, MongoClientOptions, SortOptionObject } from 'mongodb';
import type { IJobParameters } from './JobParameters';

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
	sort?: SortOptionObject<IJobParameters>;
}
