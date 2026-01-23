import type { Db, MongoClientOptions, SortDirection } from 'mongodb';
import type { IJobRepository } from './JobRepository.js';
import type { INotificationChannel } from './NotificationChannel.js';

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

/**
 * Option to pass a custom repository implementation
 */
export interface IRepositoryOptions {
	repository: IJobRepository;
}

export interface IDbConfig {
	ensureIndex?: boolean;
	sort?: {
		[key: string]: SortDirection;
	};
}

/**
 * Options for notification channel configuration
 */
export interface INotificationOptions {
	notificationChannel?: INotificationChannel;
}
