import debug from 'debug';
import type {
	ChangeStream,
	ChangeStreamDocument,
	ChangeStreamInsertDocument,
	ChangeStreamUpdateDocument,
	ChangeStreamReplaceDocument,
	ChangeStreamOptions,
	Collection,
	Db,
	ResumeToken
} from 'mongodb';
import type { JobNotification, NotificationChannelConfig, JobId } from 'agenda';
import { BaseNotificationChannel, toJobId } from 'agenda';

const log = debug('agenda:mongo:changestream');

/**
 * Configuration for MongoChangeStreamNotificationChannel
 */
export interface MongoChangeStreamNotificationChannelConfig extends NotificationChannelConfig {
	/**
	 * MongoDB database instance.
	 * Required - must be connected to a replica set.
	 */
	db?: Db;

	/**
	 * Collection name to watch (default: 'agendaJobs')
	 */
	collection?: string;

	/**
	 * Resume token to resume watching from a specific point.
	 * Useful for recovering from disconnections.
	 */
	resumeToken?: ResumeToken;

	/**
	 * Whether to use fullDocument: 'updateLookup' for update events.
	 * This fetches the full document on updates but adds latency.
	 * Default: true (required for proper notification data)
	 */
	fullDocument?: boolean;
}

/**
 * MongoDB Change Stream notification channel.
 *
 * Uses MongoDB Change Streams to watch for job changes in real-time.
 * This eliminates the need for polling and provides instant notifications
 * when jobs are created or updated.
 *
 * **Requirements:**
 * - MongoDB must be deployed as a replica set (even single-node replica sets work)
 * - WiredTiger storage engine (default since MongoDB 3.2)
 *
 * **How it works:**
 * - Watches the jobs collection for insert/update/replace operations
 * - When a job with `nextRunAt` is modified, handlers are notified
 * - The `publish()` method is a no-op since Change Streams automatically
 *   detect job changes from any source
 *
 * @example
 * ```typescript
 * import { Agenda } from 'agenda';
 * import { MongoBackend, MongoChangeStreamNotificationChannel } from '@agendajs/mongo-backend';
 *
 * const backend = new MongoBackend({ mongo: db });
 * const channel = new MongoChangeStreamNotificationChannel({ db });
 *
 * const agenda = new Agenda({
 *   backend,
 *   notificationChannel: channel
 * });
 * ```
 */
export class MongoChangeStreamNotificationChannel extends BaseNotificationChannel {
	private db?: Db;
	private collectionName: string;
	private collection?: Collection;
	private changeStream?: ChangeStream;
	private resumeToken?: ResumeToken;
	private useFullDocument: boolean;

	constructor(config: MongoChangeStreamNotificationChannelConfig = {}) {
		super(config);
		this.db = config.db;
		this.collectionName = config.collection ?? 'agendaJobs';
		this.resumeToken = config.resumeToken;
		this.useFullDocument = config.fullDocument ?? true;
	}

	/**
	 * Set the MongoDB database instance.
	 * Used when the channel is created before the database connection.
	 */
	setDb(db: Db): void {
		if (this._state === 'connected') {
			throw new Error('Cannot set database while channel is connected');
		}
		this.db = db;
	}

	/**
	 * Get the last resume token for reconnection purposes.
	 * Store this token to resume watching from the same point after restart.
	 */
	getResumeToken(): ResumeToken | undefined {
		return this.resumeToken;
	}

	async connect(): Promise<void> {
		log('connecting change stream notification channel (current state=%s)', this._state);
		this.clearReconnect();

		if (!this.db) {
			throw new Error(
				'MongoChangeStreamNotificationChannel requires a MongoDB database instance. ' +
					'Provide it via config.db or call setDb() before connecting.'
			);
		}

		try {
			this.setState('connecting');
			log('getting collection: %s', this.collectionName);
			this.collection = this.db.collection(this.collectionName);

			// Build the aggregation pipeline to filter relevant changes
			const pipeline = [
				{
					$match: {
						// Watch for job inserts, updates, and replacements
						operationType: { $in: ['insert', 'update', 'replace'] }
					}
				}
			];

			// Change stream options
			const options: ChangeStreamOptions = {};

			// Use fullDocument lookup to get the complete document on updates
			// This is required to get job data on update events
			if (this.useFullDocument) {
				options.fullDocument = 'updateLookup';
			}

			// Resume from a specific token if provided
			if (this.resumeToken) {
				options.resumeAfter = this.resumeToken;
				log('resuming from token: %O', this.resumeToken);
			}

			log('creating change stream with options: %O', options);

			// Create the change stream
			this.changeStream = this.collection.watch(pipeline, options);

			// Handle change events
			this.changeStream.on('change', (change: ChangeStreamDocument) => {
				this.handleChange(change);
			});

			// Handle errors
			this.changeStream.on('error', (error: Error) => {
				log('change stream error: %O', error);
				this.emit('error', error);

				if (this._state === 'connected') {
					this.handleConnectionLoss();
				}
			});

			// Handle stream close - only treat as connection loss if we didn't initiate it
			this.changeStream.on('close', () => {
				log('change stream closed (state=%s)', this._state);
				// Only handle as connection loss if we're still in connected state
				// (not if we're disconnecting or already disconnected)
				if (this._state === 'connected') {
					this.handleConnectionLoss();
				}
			});

			log('change stream connected, watching collection: %s', this.collectionName);
			this.setState('connected');
		} catch (error) {
			log('connection failed: %O', error);
			this.emit('error', error as Error);
			this.scheduleReconnect();
			throw error;
		}
	}

	private handleChange(change: ChangeStreamDocument): void {
		try {
			log('received change event: operationType=%s', change.operationType);

			// Store resume token for recovery
			if (change._id) {
				this.resumeToken = change._id;
			}

			// Get the full document based on operation type
			const fullDocument = this.extractFullDocument(change);
			if (!fullDocument) {
				log(
					'change event without full document (operationType=%s), skipping',
					change.operationType
				);
				return;
			}

			log(
				'extracted fullDocument: name=%s, nextRunAt=%s, disabled=%s',
				fullDocument.name,
				fullDocument.nextRunAt,
				fullDocument.disabled
			);

			// Only notify for jobs that have a nextRunAt (scheduled to run)
			if (!fullDocument.nextRunAt) {
				log('job has no nextRunAt, skipping notification');
				return;
			}

			// Skip disabled jobs
			if (fullDocument.disabled) {
				log('job is disabled, skipping notification');
				return;
			}

			// Build notification from the document
			const notification = this.buildNotification(fullDocument);
			log('received change notification: %O', notification);

			this.notifyHandlers(notification).catch((err: Error) => {
				this.emit('error', err);
			});
		} catch (error) {
			log('error processing change event: %O', error);
			this.emit('error', error as Error);
		}
	}

	private extractFullDocument(change: ChangeStreamDocument): Record<string, unknown> | null {
		// Handle insert events
		if (change.operationType === 'insert') {
			const insertChange = change as ChangeStreamInsertDocument;
			return insertChange.fullDocument as Record<string, unknown>;
		}

		// Handle update events (requires fullDocument: 'updateLookup' option)
		if (change.operationType === 'update') {
			const updateChange = change as ChangeStreamUpdateDocument;
			if (updateChange.fullDocument) {
				return updateChange.fullDocument as Record<string, unknown>;
			}
			log('update event missing fullDocument - ensure fullDocument option is set');
			return null;
		}

		// Handle replace events
		if (change.operationType === 'replace') {
			const replaceChange = change as ChangeStreamReplaceDocument;
			return replaceChange.fullDocument as Record<string, unknown>;
		}

		return null;
	}

	private buildNotification(doc: Record<string, unknown>): JobNotification {
		return {
			jobId: toJobId(String(doc._id)) as JobId,
			jobName: doc.name as string,
			nextRunAt: doc.nextRunAt ? new Date(doc.nextRunAt as string | number | Date) : null,
			priority: (doc.priority as number) || 0,
			timestamp: new Date(),
			source: 'changestream'
		};
	}

	private handleConnectionLoss(): void {
		log('handling connection loss');

		if (this.changeStream) {
			try {
				this.changeStream.close().catch(() => {
					// Ignore close errors
				});
			} catch {
				// Ignore close errors
			}
			this.changeStream = undefined;
		}

		this.scheduleReconnect();
	}

	async disconnect(): Promise<void> {
		log('disconnecting change stream notification channel');
		this.clearReconnect();

		// Set state first to prevent close event from triggering reconnection
		this.setState('disconnected');

		if (this.changeStream) {
			try {
				await this.changeStream.close();
			} catch {
				// Ignore close errors
			}
			this.changeStream = undefined;
		}

		this.handlers.clear();
	}

	/**
	 * Publish a job notification.
	 *
	 * **Note:** This method is a no-op for Change Stream notifications.
	 * Change Streams automatically detect job changes in the database,
	 * so explicit publishing is not required. This method exists only
	 * to satisfy the NotificationChannel interface.
	 *
	 * All job saves to the watched collection will automatically trigger
	 * notifications to all subscribers.
	 */
	async publish(_notification: JobNotification): Promise<void> {
		// No-op: Change Streams automatically detect database changes.
		// When a job is saved to MongoDB, the change stream will pick it up
		// and notify all handlers automatically.
		log('publish called (no-op for change stream - changes detected automatically)');
	}
}
