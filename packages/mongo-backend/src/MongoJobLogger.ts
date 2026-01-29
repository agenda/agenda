import debug from 'debug';
import type { Collection, Db, Filter, Sort } from 'mongodb';
import type { JobLogger, JobLogEntry, JobLogQuery, JobLogQueryResult, LogLevel, JobLogEvent } from 'agenda';

const log = debug('agenda:mongo:logger');

/**
 * MongoDB implementation of JobLogger.
 * Stores job lifecycle events in a dedicated MongoDB collection.
 *
 * @example
 * ```typescript
 * import { MongoBackend } from '@agendajs/mongo-backend';
 *
 * const backend = new MongoBackend({
 *   mongo: db,
 *   logging: true // enables MongoJobLogger with 'agenda_logs' collection
 * });
 * ```
 */
export class MongoJobLogger implements JobLogger {
	private collection!: Collection;
	private readonly collectionName: string;

	constructor(collectionName = 'agenda_logs') {
		this.collectionName = collectionName;
	}

	/**
	 * Set the database instance and initialize the collection.
	 * Called by MongoBackend after the repository connects.
	 */
	async setDb(db: Db): Promise<void> {
		this.collection = db.collection(this.collectionName);

		// Create indexes for efficient querying
		log('creating indexes for %s collection', this.collectionName);
		await this.collection.createIndex(
			{ timestamp: -1 },
			{ name: 'agenda_logs_timestamp_idx' }
		);
		await this.collection.createIndex(
			{ jobId: 1, timestamp: -1 },
			{ name: 'agenda_logs_job_id_idx' }
		);
		await this.collection.createIndex(
			{ jobName: 1, timestamp: -1 },
			{ name: 'agenda_logs_job_name_idx' }
		);
		log('indexes created for %s collection', this.collectionName);
	}

	async log(entry: Omit<JobLogEntry, '_id'>): Promise<void> {
		if (!this.collection) {
			log('collection not initialized, skipping log entry');
			return;
		}
		await this.collection.insertOne({ ...entry });
	}

	async getLogs(query?: JobLogQuery): Promise<JobLogQueryResult> {
		if (!this.collection) {
			return { entries: [], total: 0 };
		}

		const filter = this.buildFilter(query);
		const sort: Sort = { timestamp: query?.sort === 'asc' ? 1 : -1 };
		const limit = query?.limit ?? 50;
		const offset = query?.offset ?? 0;

		const [entries, total] = await Promise.all([
			this.collection
				.find(filter)
				.sort(sort)
				.skip(offset)
				.limit(limit)
				.toArray()
				.then(docs =>
					docs.map(doc => ({
						_id: doc._id.toHexString(),
						timestamp: doc.timestamp as Date,
						level: doc.level as LogLevel,
						event: doc.event as JobLogEvent,
						jobId: doc.jobId as string | undefined,
						jobName: doc.jobName as string,
						message: doc.message as string,
						duration: doc.duration as number | undefined,
						error: doc.error as string | undefined,
						failCount: doc.failCount as number | undefined,
						retryDelay: doc.retryDelay as number | undefined,
						retryAttempt: doc.retryAttempt as number | undefined,
						agendaName: doc.agendaName as string | undefined,
						meta: doc.meta as Record<string, unknown> | undefined
					}))
				),
			this.collection.countDocuments(filter)
		]);

		return { entries, total };
	}

	async clearLogs(query?: JobLogQuery): Promise<number> {
		if (!this.collection) {
			return 0;
		}

		const filter = this.buildFilter(query);
		const result = await this.collection.deleteMany(filter);
		return result.deletedCount;
	}

	private buildFilter(query?: JobLogQuery): Filter<Record<string, unknown>> {
		if (!query) return {};

		const filter: Filter<Record<string, unknown>> = {};

		if (query.jobId) {
			filter.jobId = query.jobId;
		}
		if (query.jobName) {
			filter.jobName = query.jobName;
		}
		if (query.level) {
			filter.level = Array.isArray(query.level)
				? { $in: query.level }
				: query.level;
		}
		if (query.event) {
			filter.event = Array.isArray(query.event)
				? { $in: query.event }
				: query.event;
		}
		if (query.from || query.to) {
			const timestampFilter: Record<string, Date> = {};
			if (query.from) timestampFilter.$gte = query.from;
			if (query.to) timestampFilter.$lte = query.to;
			filter.timestamp = timestampFilter;
		}

		return filter;
	}
}
