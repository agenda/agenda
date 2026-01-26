import debug from 'debug';
import { Redis } from 'ioredis';
import type { RedisOptions } from 'ioredis';
import type { JobNotification, NotificationChannelConfig, JobId } from 'agenda';
import { BaseNotificationChannel, toJobId } from 'agenda';

const log = debug('agenda:redis:notification');

/**
 * Configuration for RedisNotificationChannel
 */
export interface RedisNotificationChannelConfig extends NotificationChannelConfig {
	/** Redis client for publishing (shared with repository) */
	redis?: Redis;
	/** Redis connection URL (if not sharing client) */
	connectionString?: string;
	/** Redis client options (if not sharing client) */
	redisOptions?: RedisOptions;
}

/**
 * Redis notification channel using Pub/Sub
 *
 * This implementation uses Redis's built-in pub/sub mechanism
 * for real-time job notifications across multiple processes.
 *
 * Note: Redis Pub/Sub requires separate connections for subscribing
 * and publishing, so this channel creates a dedicated subscriber client.
 */
export class RedisNotificationChannel extends BaseNotificationChannel {
	private publishClient?: Redis;
	private subscribeClient?: Redis;
	private ownClient: boolean = false;
	private connectionString?: string;
	private redisOptions?: RedisOptions;

	constructor(config: RedisNotificationChannelConfig = {}) {
		super(config);

		if (config.redis) {
			this.publishClient = config.redis;
			this.ownClient = false;
		} else if (config.connectionString) {
			this.connectionString = config.connectionString;
			this.ownClient = true;
		} else if (config.redisOptions) {
			this.redisOptions = config.redisOptions;
			this.ownClient = true;
		}
	}

	/**
	 * Set the Redis client (used when created by RedisBackend)
	 */
	setRedis(redis: Redis): void {
		if (this.publishClient && this.ownClient) {
			throw new Error('Cannot set Redis client on channel with own client');
		}
		this.publishClient = redis;
		this.ownClient = false;
	}

	async connect(): Promise<void> {
		log('connecting notification channel');
		this.clearReconnect();

		try {
			// Create own client if needed
			if (!this.publishClient) {
				if (this.connectionString) {
					this.publishClient = new Redis(this.connectionString);
					this.ownClient = true;
				} else if (this.redisOptions) {
					this.publishClient = new Redis(this.redisOptions);
					this.ownClient = true;
				} else {
					throw new Error(
						'RedisNotificationChannel requires redis, connectionString, or redisOptions'
					);
				}
			}

			// Create a duplicate client for subscribing (Redis requires separate connections)
			this.subscribeClient = this.publishClient.duplicate();

			// Handle subscribe client errors
			this.subscribeClient.on('error', (error: Error) => {
				log('subscribe client error: %O', error);
				this.emit('error', error);

				if (this._state === 'connected') {
					this.handleConnectionLoss();
				}
			});

			// Set up message handler
			this.subscribeClient.on('message', (channel: string, message: string) => {
				if (channel === this.config.channelName) {
					try {
						const notification = this.parseNotification(message);
						log('received notification: %O', notification);
						this.notifyHandlers(notification).catch((err: Error) => {
							this.emit('error', err);
						});
					} catch (error) {
						log('error parsing notification: %O', error);
						this.emit('error', error as Error);
					}
				}
			});

			// Subscribe to the channel
			await this.subscribeClient.subscribe(this.config.channelName);
			log('subscribed to channel: %s', this.config.channelName);

			this.setState('connected');
		} catch (error) {
			log('connection failed: %O', error);
			this.emit('error', error as Error);
			this.scheduleReconnect();
			throw error;
		}
	}

	private handleConnectionLoss(): void {
		log('handling connection loss');

		// Clean up the subscribe client
		if (this.subscribeClient) {
			try {
				this.subscribeClient.disconnect();
			} catch {
				// Ignore disconnect errors
			}
			this.subscribeClient = undefined;
		}

		this.scheduleReconnect();
	}

	async disconnect(): Promise<void> {
		log('disconnecting notification channel');
		this.clearReconnect();

		if (this.subscribeClient) {
			try {
				await this.subscribeClient.unsubscribe(this.config.channelName);
			} catch {
				// Ignore unsubscribe errors
			}

			try {
				this.subscribeClient.disconnect();
			} catch {
				// Ignore disconnect errors
			}
			this.subscribeClient = undefined;
		}

		// Only close client if we created it
		if (this.ownClient && this.publishClient) {
			this.publishClient.disconnect();
			this.publishClient = undefined;
		}

		this.handlers.clear();
		this.setState('disconnected');
	}

	async publish(notification: JobNotification): Promise<void> {
		if (this._state !== 'connected') {
			throw new Error('Cannot publish: channel not connected');
		}

		if (!this.publishClient) {
			throw new Error('Cannot publish: no Redis client available');
		}

		const payload = this.serializeNotification(notification);
		log('publishing notification: %s', payload);

		await this.publishClient.publish(this.config.channelName, payload);
	}

	/**
	 * Serialize notification to JSON string for Redis Pub/Sub
	 */
	private serializeNotification(notification: JobNotification): string {
		return JSON.stringify({
			jobId: notification.jobId,
			jobName: notification.jobName,
			nextRunAt: notification.nextRunAt?.toISOString() || null,
			priority: notification.priority,
			timestamp: notification.timestamp.toISOString(),
			source: notification.source
		});
	}

	/**
	 * Parse notification from JSON string received via Pub/Sub
	 */
	private parseNotification(payload: string): JobNotification {
		const data = JSON.parse(payload);

		return {
			jobId: toJobId(data.jobId) as JobId,
			jobName: data.jobName,
			nextRunAt: data.nextRunAt ? new Date(data.nextRunAt) : null,
			priority: data.priority,
			timestamp: new Date(data.timestamp),
			source: data.source
		};
	}
}
