import * as debug from 'debug';
import {
	Collection,
	Db,
	FilterQuery,
	MongoClient,
	MongoClientOptions,
	UpdateQuery,
	ObjectId
} from 'mongodb';
import type { Job } from './Job';
import { hasMongoProtocol } from './utils/mongodb';
import type { Agenda } from './index';
import { IDatabaseOptions, IDbConfig, IMongoOptions } from './types/DbOptions';
import { IJobParameters } from './types/JobParameters';

const log = debug('agenda:db');

export class JobDbRepository {
	collection: Collection;

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

	private hasMongoConnection(connectOptions): connectOptions is IMongoOptions {
		return !!connectOptions.mongo;
	}

	private hasDatabaseConfig(connectOptions: any): connectOptions is IDatabaseOptions {
		return !!connectOptions.db?.address;
	}

	async getJobs(query: any, sort: any = {}, limit = 0, skip = 0) {
		return this.collection.find(query).sort(sort).limit(limit).skip(skip).toArray();
	}

	async removeJobs(query: any) {
		return this.collection.deleteMany(query);
	}

	async getQueueSize(): Promise<number> {
		return this.collection.countDocuments({ nextRunAt: { $lt: new Date() } });
	}

	/**
	 * Internal method to unlock jobs so that they can be re-run
	 */
	async unlockJobs(jobIds: ObjectId[]) {
		await this.collection.updateMany({ _id: { $in: jobIds } }, { $set: { lockedAt: null } });
	}

	async lockJob(job: Job): Promise<IJobParameters | undefined> {
		// Query to run against collection to see if we need to lock it
		const criteria = {
			_id: job.attrs._id,
			name: job.attrs.name,
			lockedAt: null,
			nextRunAt: job.attrs.nextRunAt,
			disabled: { $ne: true }
		};

		// Update / options for the MongoDB query
		const update = { $set: { lockedAt: new Date() } };
		const options = { returnOriginal: false };

		// Lock the job in MongoDB!
		const resp = await this.collection.findOneAndUpdate(criteria, update, options);
		return resp?.value;
	}

	async getNextJobToRun(
		jobName: string,
		nextScanAt: Date,
		lockDeadline: Date,
		now: Date = new Date()
	): Promise<IJobParameters | undefined> {
		// /**
		// * Query used to find job to run
		// * @type {{$and: [*]}}
		// */
		const JOB_PROCESS_WHERE_QUERY = {
			$and: [
				{
					name: jobName,
					disabled: { $ne: true }
				},
				{
					$or: [
						{
							lockedAt: { $eq: null },
							nextRunAt: { $lte: nextScanAt }
						},
						{
							lockedAt: { $lte: lockDeadline }
						}
					]
				}
			]
		};

		/**
		 * Query used to set a job as locked
		 * @type {{$set: {lockedAt: Date}}}
		 */
		const JOB_PROCESS_SET_QUERY = { $set: { lockedAt: now } };

		/**
		 * Query used to affect what gets returned
		 * @type {{returnOriginal: boolean, sort: object}}
		 */
		const JOB_RETURN_QUERY = { returnOriginal: false, sort: this.connectOptions.sort };

		// Find ONE and ONLY ONE job and set the 'lockedAt' time so that job begins to be processed
		const result = await this.collection.findOneAndUpdate(
			JOB_PROCESS_WHERE_QUERY,
			JOB_PROCESS_SET_QUERY,
			JOB_RETURN_QUERY
		);

		return result.value;
	}

	async connect() {
		const db = await this.createConnection();
		log('successful connection to MongoDB', db.options);

		const collection = this.connectOptions.db?.collection || 'agendaJobs';

		this.collection = db.collection(collection);
		log(
			`connected with collection: ${collection}, collection size: ${
				typeof this.collection.estimatedDocumentCount === 'function'
					? await this.collection.estimatedDocumentCount()
					: '?'
			}`
		);

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
			} catch (err) {
				console.error('db index creation failed', err);
			}
		}

		this.agenda.emit('ready');
	}

	private async database(url: string, options?: MongoClientOptions) {
		if (!hasMongoProtocol(url)) {
			url = `mongodb://${url}`;
		}

		const client = await MongoClient.connect(url, {
			...options,
			useNewUrlParser: true,
			useUnifiedTopology: true
		});

		return client.db();
	}

	private processDbResult(job: Job, res: IJobParameters) {
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

	/**
	 * Save the properties on a job to MongoDB
	 * @name Agenda#saveJob
	 * @function
	 * @param {Job} job job to save into MongoDB
	 * @returns {Promise} resolves when job is saved or errors
	 */
	async saveJob<T = any>(job: Job<T>): Promise<Job<T>> {
		try {
			log('attempting to save a job into Agenda instance');

			// Grab information needed to save job but that we don't want to persist in MongoDB
			const id = job.attrs._id;
			// const { unique, uniqueOpts } = job.attrs;

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
			let update: UpdateQuery<any> = { $set: props };
			log('current time stored as %s', now.toISOString());

			// If the job already had an ID, then update the properties of the job
			// i.e, who last modified it, etc
			if (id) {
				// Update the job and process the resulting data'
				log('job already has _id, calling findOneAndUpdate() using _id as query');
				const result = await this.collection.findOneAndUpdate(
					{ _id: id, name: props.name },
					update,
					{ returnOriginal: false }
				);
				return this.processDbResult(job, result.value);
			}

			if (props.type === 'single') {
				// Job type set to 'single' so...
				log('job with type of "single" found');

				// If the nextRunAt time is older than the current time, "protect" that property, meaning, don't change
				// a scheduled job's next run time!
				if (props.nextRunAt && props.nextRunAt <= now) {
					log('job has a scheduled nextRunAt time, protecting that field from upsert');
					protect.nextRunAt = props.nextRunAt;
					delete props.nextRunAt;
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
						returnOriginal: false // same as new: true -> returns the final document
					}
				);
				log(
					`findOneAndUpdate(${props.name}) with type "single" ${
						result.lastErrorObject?.updatedExisting
							? 'updated existing entry'
							: 'inserted new entry'
					}`
				);
				return this.processDbResult(job, result.value);
			}

			if (job.attrs.unique) {
				// If we want the job to be unique, then we can upsert based on the 'unique' query object that was passed in
				const query: FilterQuery<any> = job.attrs.unique;
				query.name = props.name;
				if (job.attrs.uniqueOpts?.insertOnly) {
					update = { $setOnInsert: props };
				}

				// console.log('update', query, update, uniqueOpts);

				// Use the 'unique' query object to find an existing job or create a new one
				log('calling findOneAndUpdate() with unique object as query: \n%O', query);
				const result = await this.collection.findOneAndUpdate(query, update, {
					upsert: true,
					returnOriginal: false
				});
				return this.processDbResult(job, result.value);
			}

			// If all else fails, the job does not exist yet so we just insert it into MongoDB
			log(
				'using default behavior, inserting new job via insertOne() with props that were set: \n%O',
				props
			);
			const result = await this.collection.insertOne(props);
			return this.processDbResult(job, result.ops[0]);
		} catch (error) {
			log('processDbResult() received an error, job was not updated/created');
			throw error;
		}
	}
}
