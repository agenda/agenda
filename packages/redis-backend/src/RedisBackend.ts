import debug from 'debug';
import type { IAgendaBackend, IJobRepository, INotificationChannel } from 'agenda';
import { RedisJobRepository } from './RedisJobRepository.js';
import { RedisNotificationChannel } from './RedisNotificationChannel.js';
import type { IRedisBackendConfig } from './types.js';

const log = debug('agenda:redis:backend');

/**
 * Redis backend for Agenda
 *
 * Provides both storage (via RedisJobRepository) and real-time notifications
 * (via RedisNotificationChannel using Pub/Sub).
 *
 * @example
 * ```typescript
 * import { Agenda } from 'agenda';
 * import { RedisBackend } from '@agenda.js/redis-backend';
 *
 * // Using connection string
 * const agenda = new Agenda({
 *   backend: new RedisBackend({
 *     connectionString: 'redis://localhost:6379'
 *   })
 * });
 *
 * // Or using an existing Redis client (e.g., shared with your app)
 * // The client will NOT be closed when Agenda disconnects
 * import Redis from 'ioredis';
 * const redis = new Redis();
 *
 * const agenda = new Agenda({
 *   backend: new RedisBackend({ redis })
 * });
 *
 * // Your app can continue using the client after agenda.stop()
 *
 * agenda.define('myJob', async (job) => {
 *   console.log('Running job:', job.attrs.name);
 * });
 *
 * await agenda.start();
 * await agenda.every('5 minutes', 'myJob');
 * ```
 */
export class RedisBackend implements IAgendaBackend {
	private _repository: RedisJobRepository;
	private _notificationChannel: RedisNotificationChannel;
	private config: IRedisBackendConfig;

	constructor(config: IRedisBackendConfig) {
		this.config = config;

		// Create repository
		this._repository = new RedisJobRepository(config);

		// Create notification channel
		this._notificationChannel = new RedisNotificationChannel({
			channelName: config.channelName,
			reconnect: {
				enabled: true
			}
		});

		log('RedisBackend created with config: %O', {
			keyPrefix: config.keyPrefix || 'agenda:',
			channelName: config.channelName || 'agenda:jobs'
		});
	}

	/**
	 * The job repository for storage operations
	 */
	get repository(): IJobRepository {
		return this._repository;
	}

	/**
	 * The notification channel for real-time notifications via Pub/Sub
	 */
	get notificationChannel(): INotificationChannel {
		return this._notificationChannel;
	}

	/**
	 * Connect to Redis
	 *
	 * - Establishes Redis connection
	 * - Sets up Pub/Sub for real-time notifications
	 */
	async connect(): Promise<void> {
		log('connecting RedisBackend');

		// Connect repository first
		await this._repository.connect();

		// Share the Redis client with notification channel
		this._notificationChannel.setRedis(this._repository.getRedis());

		// Note: notification channel is connected by Agenda.start()
		// when it's needed, so we don't connect it here

		log('RedisBackend connected');
	}

	/**
	 * Disconnect from Redis
	 *
	 * - Unsubscribes from Pub/Sub channel
	 * - Closes Redis connection
	 */
	async disconnect(): Promise<void> {
		log('disconnecting RedisBackend');

		// Notification channel is disconnected by Agenda.stop()
		// Repository disconnect will close the shared client
		await this._repository.disconnect();

		log('RedisBackend disconnected');
	}
}
