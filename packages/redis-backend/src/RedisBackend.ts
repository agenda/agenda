import debug from 'debug';
import type { AgendaBackend, JobRepository, NotificationChannel, JobLogger } from 'agenda';
import { RedisJobRepository } from './RedisJobRepository.js';
import { RedisJobLogger } from './RedisJobLogger.js';
import { RedisNotificationChannel } from './RedisNotificationChannel.js';
import type { RedisBackendConfig } from './types.js';

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
 * import { RedisBackend } from '@agendajs/redis-backend';
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
export class RedisBackend implements AgendaBackend {
	readonly name = 'Redis';

	private _repository: RedisJobRepository;
	private _notificationChannel: RedisNotificationChannel;
	private _logger?: RedisJobLogger;
	private config: RedisBackendConfig;
	private _ownsConnection: boolean;

	constructor(config: RedisBackendConfig) {
		this.config = config;

		// Determine if we own the connection (not passed in by user)
		this._ownsConnection = !config.redis;

		// Create repository
		this._repository = new RedisJobRepository(config);

		// Create notification channel
		this._notificationChannel = new RedisNotificationChannel({
			channelName: config.channelName,
			reconnect: {
				enabled: true
			}
		});

		// Create job logger if logging is enabled
		if (config.logging) {
			this._logger = new RedisJobLogger(config.keyPrefix);
		}

		log('RedisBackend created with config: %O', {
			keyPrefix: config.keyPrefix || 'agenda:',
			channelName: config.channelName || 'agenda:jobs',
			logging: config.logging ?? false
		});
	}

	/**
	 * The job repository for storage operations
	 */
	get repository(): JobRepository {
		return this._repository;
	}

	/**
	 * The job logger for persistent event logging.
	 * Only available when `logging: true` is set in config.
	 */
	get logger(): JobLogger | undefined {
		return this._logger;
	}

	/**
	 * The notification channel for real-time notifications via Pub/Sub
	 */
	get notificationChannel(): NotificationChannel {
		return this._notificationChannel;
	}

	/**
	 * Whether this backend owns its Redis connection.
	 * True if created from connectionString/redisOptions, false if redis client was passed in.
	 */
	get ownsConnection(): boolean {
		return this._ownsConnection;
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

		// Initialize the job logger with the shared Redis client
		if (this._logger) {
			this._logger.setRedis(this._repository.getRedis());
		}

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
