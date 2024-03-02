import * as debug from 'debug';
import {
	Collection,
	Db,
	Filter,
	FindOneAndUpdateOptions,
	MongoClient,
	MongoClientOptions,
	ObjectId,
	Sort,
	UpdateFilter
} from 'mongodb';
import type { Job, JobWithId } from './Job';
import type { Agenda } from './index';
import type { IDatabaseOptions, IDbConfig, IMongoOptions } from './types/DbOptions';
import type { IJobParameters } from './types/JobParameters';
import { hasMongoProtocol } from './utils/hasMongoProtocol';

const log = debug('agenda:db');

/**
 * @class
 */
export class JobDbRepository {
	collection: Collection<IJobParameters>;

	constructor(
		private agenda: Agenda,
		private connectOptions: (IDatabaseOptions | IMongoOptions) & IDbConfig
	) {
		this.connectOptions.sort = this.connectOptions.sort || { nextRunAt: 1, priority: -1 };
	}

	private async createConnection(): Promise<Db> {
		const { connectOptions } = this;
		if (this.hasDatabaseConfig(connectOptions)) {
			log('using database config', connectOptions);
			return this.database(connectOptions.db.address, connectOptions.db.options);
		}

		if (this.hasMongoConnection(connectOptions)) {
			log('using passed in mongo connection');
			return connectOptions.mongo;
		}

		throw new Error('invalid db config, or db config not found');
	}

	private hasMongoConnection(connectOptions: unknown): connectOptions is IMongoOptions {
		return !!(connectOptions as IMongoOptions)?.mongo;
	}

	private hasDatabaseConfig(connectOptions: unknown): connectOptions is IDatabaseOptions {
		return !!(connectOptions as IDatabaseOptions)?.db?.address;
	}

	async getJobById(id: string) {
		return this.collection.findOne({ _id: new ObjectId(id) });
	}

	async getJobs(
		query: Filter<IJobParameters>,
		sort: Sort = {},
		limit = 0,
		skip = 0
	): Promise<IJobParameters[]> {
		return this.collection.find(query).sort(sort).limit(limit).skip(skip).toArray();
	}

	async removeJobs(query: Filter<IJobParameters>): Promise<number> {
		const result = await this.collection.deleteMany(query);
		return result.deletedCount || 0;
	}

	async getQueueSize(): Promise<number> {
		return this.collection.countDocuments({ nextRunAt: { $lt: new Date() } });
	}

	async unlockJob(job: Job): Promise<void> {
		// only unlock jobs which are not currently processed (nextRunAT is not null)
		await this.collection.updateOne(
			{ _id: job.attrs._id, nextRunAt: { $ne: null } },
			{ $unset: { lockedAt: true } }
		);
	}

	/**
	 * Internal method to unlock jobs so that they can be re-run
	 */
	async unlockJobs(jobIds: ObjectId[]): Promise<void> {
		await this.collection.updateMany(
			{ _id: { $in: jobIds }, nextRunAt: { $ne: null } },
			{ $unset: { lockedAt: true } }
		);
	}

	async lockJob(job: JobWithId): Promise<IJobParameters | undefined> {
		// Query to run against collection to see if we need to lock it
		const criteria: Filter<Omit<IJobParameters, 'lockedAt'> & { lockedAt?: Date | null }> = {
			_id: job.attrs._id,
			name: job.attrs.name,
			lockedAt: null,
			nextRunAt: job.attrs.nextRunAt,
			disabled: { $ne: true }
		};

		// Update / options for the MongoDB query
		const update: UpdateFilter<IJobParameters> = { $set: { lockedAt: new Date() } };
		const options: FindOneAndUpdateOptions = {
			returnDocument: 'after',
			sort: this.connectOptions.sort
		};

		// Lock the job in MongoDB!
		const resp = await this.collection.findOneAndUpdate(
			criteria as Filter<IJobParameters>,
			update,
			{ ...options, includeResultMetadata: true }
		);

		return resp?.value || undefined;
	}

	async getNextJobToRun(
		jobName: string,
		nextScanAt: Date,
		lockDeadline: Date,
		now: Date = new Date()
	): Promise<IJobParameters | undefined> {
		/**
		 * Query used to find job to run
		 */
		const JOB_PROCESS_WHERE_QUERY: Filter<IJobParameters /* Omit<IJobParameters, 'lockedAt'> & { lockedAt?: Date | null } */> =
			{
				name: jobName,
				disabled: { $ne: true },
				$or: [
					{
						lockedAt: { $eq: null as any },
						nextRunAt: { $lte: nextScanAt }
					},
					{
						lockedAt: { $lte: lockDeadline }
					}
				]
			};

		/**
		 * Query used to set a job as locked
		 */
		const JOB_PROCESS_SET_QUERY: UpdateFilter<IJobParameters> = { $set: { lockedAt: now } };

		/**
		 * Query used to affect what gets returned
		 */
		const JOB_RETURN_QUERY: FindOneAndUpdateOptions = {
			returnDocument: 'after',
			sort: this.connectOptions.sort
		};

		// Find ONE and ONLY ONE job and set the 'lockedAt' time so that job begins to be processed
		const result = await this.collection.findOneAndUpdate(
			JOB_PROCESS_WHERE_QUERY,
			JOB_PROCESS_SET_QUERY,
			{ ...JOB_RETURN_QUERY, includeResultMetadata: true }
		);

		return result.value || undefined;
	}

	async connect(): Promise<void> {
		const db = await this.createConnection();
		log('successful connection to MongoDB', db.options);

		const collection = this.connectOptions.db?.collection || 'agendaJobs';

		this.collection = db.collection(collection);
		if (log.enabled) {
			log(
				`connected with collection: ${collection}, collection size: ${
					typeof this.collection.estimatedDocumentCount === 'function'
						? await this.collection.estimatedDocumentCount()
						: '?'
				}`
			);
		}

		if (this.connectOptions.ensureIndex) {
			log('attempting index creation');
			try {
				const result = await this.collection.createIndex(
					{
						name: 1,
						...this.connectOptions.sort,
						priority: -1,
						lockedAt: 1,
						nextRunAt: 1,
						disabled: 1
					},
					{ name: 'findAndLockNextJobIndex' }
				);
				log('index succesfully created', result);
			} catch (error) {
				log('db index creation failed', error);
				throw error;
			}
		}

		this.agenda.emit('ready');
	}

	private async database(url: string, options?: MongoClientOptions) {
		let connectionString = url;

		if (!hasMongoProtocol(connectionString)) {
			connectionString = `mongodb://${connectionString}`;
		}

		const client = await MongoClient.connect(connectionString, {
			...options
		});

		return client.db();
	}

	private processDbResult<DATA = unknown | void>(
		job: Job<DATA>,
		res?: IJobParameters<DATA>
	): Job<DATA> {
		log(
			'processDbResult() called with success, checking whether to process job immediately or not'
		);

		// We have a result from the above calls
		if (res) {
			// Grab ID and nextRunAt from MongoDB and store it as an attribute on Job
			job.attrs._id = res._id;
			job.attrs.nextRunAt = res.nextRunAt;

			// check if we should process the job immediately
			this.agenda.emit('processJob', job);
		}

		// Return the Job instance
		return job;
	}

	async saveJobState(job: Job<any>): Promise<void> {
		const id = job.attrs._id;
		const $set = {
			lockedAt: (job.attrs.lockedAt && new Date(job.attrs.lockedAt)) || undefined,
			nextRunAt: (job.attrs.nextRunAt && new Date(job.attrs.nextRunAt)) || undefined,
			lastRunAt: (job.attrs.lastRunAt && new Date(job.attrs.lastRunAt)) || undefined,
			progress: job.attrs.progress,
			failReason: job.attrs.failReason,
			failCount: job.attrs.failCount,
			failedAt: job.attrs.failedAt && new Date(job.attrs.failedAt),
			lastFinishedAt: (job.attrs.lastFinishedAt && new Date(job.attrs.lastFinishedAt)) || undefined
		};

		log('[job %s] save job state: \n%O', id, $set);

		const result = await this.collection.updateOne(
			{ _id: id, name: job.attrs.name },
			{
				$set
			}
		);

		if (!result.acknowledged || result.matchedCount !== 1) {
			throw new Error(
				`job ${id} (name: ${job.attrs.name}) cannot be updated in the database, maybe it does not exist anymore?`
			);
		}
	}

	/**
	 * Save the properties on a job to MongoDB
	 * @name Agenda#saveJob
	 * @function
	 * @param {Job} job job to save into MongoDB
	 * @returns {Promise} resolves when job is saved or errors
	 */
	async saveJob<DATA = unknown | void>(job: Job<DATA>): Promise<Job<DATA>> {
		try {
			log('attempting to save a job');

			// Grab information needed to save job but that we don't want to persist in MongoDB
			const id = job.attrs._id;

			// Store job as JSON and remove props we don't want to store from object
			// _id, unique, uniqueOpts
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { _id, unique, uniqueOpts, ...props } = {
				...job.toJson(),
				// Store name of agenda queue as last modifier in job data
				lastModifiedBy: this.agenda.attrs.name
			};

			log('[job %s] set job props: \n%O', id, props);

			// Grab current time and set default query options for MongoDB
			const now = new Date();
			const protect: Partial<IJobParameters> = {};
			let update: UpdateFilter<IJobParameters> = { $set: props };
			log('current time stored as %s', now.toISOString());

			// If the job already had an ID, then update the properties of the job
			// i.e, who last modified it, etc
			if (id) {
				// Update the job and process the resulting data'
				log('job already has _id, calling findOneAndUpdate() using _id as query');
				const result = await this.collection.findOneAndUpdate(
					{ _id: id, name: props.name },
					update,
					{ returnDocument: 'after', includeResultMetadata: true }
				);
				return this.processDbResult(job, result.value as IJobParameters<DATA>);
			}

			if (props.type === 'single') {
				// Job type set to 'single' so...
				log('job with type of "single" found');

				// If the nextRunAt time is older than the current time, "protect" that property, meaning, don't change
				// a scheduled job's next run time!
				if (props.nextRunAt && props.nextRunAt <= now) {
					log('job has a scheduled nextRunAt time, protecting that field from upsert');
					protect.nextRunAt = props.nextRunAt;
					delete (props as Partial<IJobParameters>).nextRunAt;
				}

				// If we have things to protect, set them in MongoDB using $setOnInsert
				if (Object.keys(protect).length > 0) {
					update.$setOnInsert = protect;
				}

				// Try an upsert
				log(
					`calling findOneAndUpdate(${props.name}) with job name and type of "single" as query`,
					await this.collection.findOne({
						name: props.name,
						type: 'single'
					})
				);
				// this call ensure a job of this name can only exists once
				const result = await this.collection.findOneAndUpdate(
					{
						name: props.name,
						type: 'single'
					},
					update,
					{
						upsert: true,
						returnDocument: 'after',
						includeResultMetadata: true
					}
				);
				log(
					`findOneAndUpdate(${props.name}) with type "single" ${
						result.lastErrorObject?.updatedExisting
							? 'updated existing entry'
							: 'inserted new entry'
					}`
				);
				return this.processDbResult(job, result.value as IJobParameters<DATA>);
			}

			if (job.attrs.unique) {
				// If we want the job to be unique, then we can upsert based on the 'unique' query object that was passed in
				const query: Filter<Omit<IJobParameters<DATA>, 'unique'>> = job.attrs.unique;
				query.name = props.name;
				if (job.attrs.uniqueOpts?.insertOnly) {
					update = { $setOnInsert: props };
				}

				// Use the 'unique' query object to find an existing job or create a new one
				log('calling findOneAndUpdate() with unique object as query: \n%O', query);
				const result = await this.collection.findOneAndUpdate(query as IJobParameters, update, {
					upsert: true,
					returnDocument: 'after',
					includeResultMetadata: true
				});
				return this.processDbResult(job, result.value as IJobParameters<DATA>);
			}

			// If all else fails, the job does not exist yet, so we just insert it into MongoDB
			log(
				'using default behavior, inserting new job via insertOne() with props that were set: \n%O',
				props
			);
			const result = await this.collection.insertOne(props);
			return this.processDbResult(job, {
				_id: result.insertedId,
				...props
			} as IJobParameters<DATA>);
		} catch (error) {
			log('processDbResult() received an error, job was not updated/created');
			throw error;
		}
	}
}
