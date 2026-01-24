import debug from 'debug';
import { Pool, PoolClient } from 'pg';
import type { IJobNotification, INotificationChannelConfig, JobId } from 'agenda';
import { BaseNotificationChannel, toJobId } from 'agenda';

const log = debug('agenda:postgres:notification');

/**
 * Configuration for PostgresNotificationChannel
 */
export interface IPostgresNotificationChannelConfig extends INotificationChannelConfig {
	/** PostgreSQL connection pool (shared with repository) */
	pool?: Pool;
	/** PostgreSQL connection string (if not sharing pool) */
	connectionString?: string;
}

/**
 * PostgreSQL notification channel using LISTEN/NOTIFY
 *
 * This implementation uses PostgreSQL's built-in pub/sub mechanism
 * for real-time job notifications across multiple processes.
 */
export class PostgresNotificationChannel extends BaseNotificationChannel {
	private pool?: Pool;
	private ownPool: boolean = false;
	private connectionString?: string;
	private listenClient?: PoolClient;

	constructor(config: IPostgresNotificationChannelConfig = {}) {
		super(config);

		if (config.pool) {
			this.pool = config.pool;
			this.ownPool = false;
		} else if (config.connectionString) {
			this.connectionString = config.connectionString;
			this.ownPool = true;
		}
	}

	/**
	 * Set the pool (used when created by PostgresBackend)
	 */
	setPool(pool: Pool): void {
		if (this.pool && this.ownPool) {
			throw new Error('Cannot set pool on channel with own pool');
		}
		this.pool = pool;
		this.ownPool = false;
	}

	async connect(): Promise<void> {
		log('connecting notification channel');
		this.clearReconnect();

		try {
			// Create own pool if needed
			if (!this.pool && this.connectionString) {
				this.pool = new Pool({ connectionString: this.connectionString });
				this.ownPool = true;
			}

			if (!this.pool) {
				throw new Error('PostgresNotificationChannel requires pool or connectionString');
			}

			// Get a dedicated connection for LISTEN
			this.listenClient = await this.pool.connect();

			// Set up notification handler
			this.listenClient.on('notification', msg => {
				if (msg.channel === this.config.channelName && msg.payload) {
					try {
						const notification = this.parseNotification(msg.payload);
						log('received notification: %O', notification);
						this.notifyHandlers(notification).catch(err => {
							this.emit('error', err);
						});
					} catch (error) {
						log('error parsing notification: %O', error);
						this.emit('error', error as Error);
					}
				}
			});

			// Handle connection errors
			this.listenClient.on('error', error => {
				log('listen client error: %O', error);
				this.emit('error', error);

				// Try to reconnect if the connection was lost
				if (this._state === 'connected') {
					this.handleConnectionLoss();
				}
			});

			// Start listening
			await this.listenClient.query(`LISTEN "${this.config.channelName}"`);
			log('listening on channel: %s', this.config.channelName);

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

		// Clean up the listen client
		if (this.listenClient) {
			try {
				this.listenClient.release(true); // Destroy the client
			} catch {
				// Ignore release errors
			}
			this.listenClient = undefined;
		}

		this.scheduleReconnect();
	}

	async disconnect(): Promise<void> {
		log('disconnecting notification channel');
		this.clearReconnect();

		if (this.listenClient) {
			try {
				await this.listenClient.query(`UNLISTEN "${this.config.channelName}"`);
			} catch {
				// Ignore UNLISTEN errors (connection might be dead)
			}

			try {
				this.listenClient.release();
			} catch {
				// Ignore release errors
			}
			this.listenClient = undefined;
		}

		// Only close pool if we created it
		if (this.ownPool && this.pool) {
			await this.pool.end();
			this.pool = undefined;
		}

		this.handlers.clear();
		this.setState('disconnected');
	}

	async publish(notification: IJobNotification): Promise<void> {
		if (this._state !== 'connected') {
			throw new Error('Cannot publish: channel not connected');
		}

		if (!this.pool) {
			throw new Error('Cannot publish: no pool available');
		}

		const payload = this.serializeNotification(notification);
		log('publishing notification: %s', payload);

		// NOTIFY doesn't support parameterized queries, so we must escape the payload
		// PostgreSQL escapes single quotes by doubling them
		const escapedPayload = payload.replace(/'/g, "''");
		await this.pool.query(`NOTIFY "${this.config.channelName}", '${escapedPayload}'`);
	}

	/**
	 * Serialize notification to JSON string for NOTIFY payload
	 */
	private serializeNotification(notification: IJobNotification): string {
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
	 * Parse notification from JSON string received via LISTEN
	 */
	private parseNotification(payload: string): IJobNotification {
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
