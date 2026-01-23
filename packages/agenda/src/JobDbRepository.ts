import debug from 'debug';
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
import type { IDbConfig } from './types/DbOptions.js';
import type { IJobParameters, JobId } from './types/JobParameters.js';
import { toJobId } from './types/JobParameters.js';
import type {
	IJobsQueryOptions,
	IJobsResult,
	IJobsOverview,
	IJobWithState,
	IJobsSort
} from './types/JobQuery.js';
import { computeJobState } from './types/JobQuery.js';
import type { IJobRepository, IRemoveJobsOptions } from './types/JobRepository.js';
import { hasMongoProtocol } from './utils/hasMongoProtocol.js';

const log = debug('agenda:db');

/**
 * Internal MongoDB document type with ObjectId for _id
 * This is what's actually stored in MongoDB, separate from the public IJobParameters interface
 */
type MongoJobDocument = Omit<IJobParameters, '_id'> & { _id?: ObjectId };

/**
 * Configuration options for JobDbRepository
 */
export interface IJobDbRepositoryConfig extends IDbConfig {
	/** MongoDB connection string */
	db?: { address: string; collection?: string; options?: MongoClientOptions };
	/** Existing MongoDB database instance */
	mongo?: Db;
	/** Name to set as lastModifiedBy on jobs */
	name?: string;
}

/**
 * @class
 * MongoDB implementation of IJobRepository
 */
export class JobDbRepository implements IJobRepository {
	collection!: Collection<MongoJobDocument>;

	constructor(private connectOptions: IJobDbRepositoryConfig) {
		this.connectOptions.sort = this.connectOptions.sort || { nextRunAt: 1, priority: -1 };
	}

	private async createConnection(): Promise<Db> {
		const { connectOptions } = this;
		if (connectOptions.db?.address) {
			log('using database config', connectOptions);
			return this.database(connectOptions.db.address, connectOptions.db.options);
		}

		if (connectOptions.mongo) {
			log('using passed in mongo connection');
			return connectOptions.mongo;
		}

		throw new Error('invalid db config, or db config not found');
	}

	async getJobById(id: string): Promise<IJobParameters | null> {
		const doc = await this.collection.findOne({ _id: new ObjectId(id) });
		if (!doc) return null;
		// Convert MongoDB ObjectId to JobId
		return {
			...doc,
			_id: toJobId(doc._id.toHexString())
		};
	}

	/**
	 * Convert generic sort options to MongoDB sort
	 */
	private toMongoSort(sort?: IJobsSort): Sort {
		if (!sort) {
			return { nextRunAt: -1, lastRunAt: -1 };
		}
		const mongoSort: Record<string, 1 | -1> = {};
		if (sort.nextRunAt !== undefined) mongoSort.nextRunAt = sort.nextRunAt;
		if (sort.lastRunAt !== undefined) mongoSort.lastRunAt = sort.lastRunAt;
		if (sort.lastFinishedAt !== undefined) mongoSort.lastFinishedAt = sort.lastFinishedAt;
		if (sort.priority !== undefined) mongoSort.priority = sort.priority;
		if (sort.name !== undefined) mongoSort.name = sort.name;
		if (sort.data !== undefined) mongoSort.data = sort.data;
		return Object.keys(mongoSort).length > 0 ? mongoSort : { nextRunAt: -1, lastRunAt: -1 };
	}

	/**
	 * Query jobs with database-agnostic options.
	 * Handles state computation and filtering internally.
	 */
	async queryJobs(options: IJobsQueryOptions = {}): Promise<IJobsResult> {
		const { name, names, state, id, ids, search, data, includeDisabled = true, sort, skip = 0, limit = 0 } = options;
		const now = new Date();

		// Build MongoDB query from options
		const query: Filter<MongoJobDocument> = {};

		if (name) {
			query.name = name;
		} else if (names && names.length > 0) {
			query.name = { $in: names };
		}

		if (id) {
			try {
				query._id = new ObjectId(id);
			} catch {
				return { jobs: [], total: 0 };
			}
		} else if (ids && ids.length > 0) {
			try {
				query._id = { $in: ids.map(i => new ObjectId(i)) };
			} catch {
				return { jobs: [], total: 0 };
			}
		}

		if (search) {
			query.name = { $regex: search, $options: 'i' };
		}

		if (data !== undefined) {
			query.data = data as IJobParameters['data'];
		}

		if (!includeDisabled) {
			query.disabled = { $ne: true };
		}

		// Fetch jobs
		const allJobs = await this.collection
			.find(query)
			.sort(this.toMongoSort(sort))
			.toArray();

		// Compute states and filter by state if specified
		let jobsWithState: IJobWithState[] = allJobs
			.map(job => ({
				...job,
				_id: toJobId(job._id!.toHexString()),
				state: computeJobState(job as unknown as IJobParameters, now)
			}))
			.filter(job => !state || job.state === state);

		// Apply pagination after state filtering
		const total = jobsWithState.length;
		if (limit > 0) {
			jobsWithState = jobsWithState.slice(skip, skip + limit);
		} else if (skip > 0) {
			jobsWithState = jobsWithState.slice(skip);
		}

		return { jobs: jobsWithState, total };
	}

	/**
	 * Get overview statistics for jobs grouped by name.
	 * Returns counts of jobs in each state for each job name.
	 */
	async getJobsOverview(): Promise<IJobsOverview[]> {
		const now = new Date();
		const names = await this.getDistinctJobNames();

		const overviews = await Promise.all(
			names.map(async name => {
				const jobs = await this.collection.find({ name }).toArray();
				const overview: IJobsOverview = {
					name,
					total: jobs.length,
					running: 0,
					scheduled: 0,
					queued: 0,
					completed: 0,
					failed: 0,
					repeating: 0
				};

				for (const job of jobs) {
					const state = computeJobState(job as unknown as IJobParameters, now);
					overview[state]++;
				}

				return overview;
			})
		);

		return overviews;
	}

	/**
	 * Get all distinct job names
	 */
	async getDistinctJobNames(): Promise<string[]> {
		return this.collection.distinct('name');
	}

	async getQueueSize(): Promise<number> {
		return this.collection.countDocuments({ nextRunAt: { $lt: new Date() } });
	}

	async removeJobs(options: IRemoveJobsOptions): Promise<number> {
		const query: Filter<MongoJobDocument> = {};

		if (options.id) {
			try {
				query._id = new ObjectId(options.id.toString());
			} catch {
				return 0;
			}
		} else if (options.ids && options.ids.length > 0) {
			try {
				query._id = { $in: options.ids.map(id => new ObjectId(id.toString())) };
			} catch {
				return 0;
			}
		}

		if (options.name) {
			query.name = options.name;
		} else if (options.names && options.names.length > 0) {
			query.name = { $in: options.names };
		} else if (options.notNames && options.notNames.length > 0) {
			query.name = { $nin: options.notNames };
		}

		if (options.data !== undefined) {
			query.data = options.data as IJobParameters['data'];
		}

		// If no criteria provided, don't delete anything
		if (Object.keys(query).length === 0) {
			return 0;
		}

		const result = await this.collection.deleteMany(query);
		return result.deletedCount || 0;
	}

	async unlockJob(job: IJobParameters): Promise<void> {
		if (!job._id) return;
		// only unlock jobs which are not currently processed (nextRunAt is not null)
		await this.collection.updateOne(
			{ _id: new ObjectId(job._id.toString()), nextRunAt: { $ne: null } },
			{ $unset: { lockedAt: true } }
		);
	}

	/**
	 * Internal method to unlock jobs so that they can be re-run
	 */
	async unlockJobs(jobIds: (JobId | string)[]): Promise<void> {
		if (jobIds.length === 0) return;
		const objectIds = jobIds.map(id => new ObjectId(id.toString()));
		await this.collection.updateMany(
			{ _id: { $in: objectIds }, nextRunAt: { $ne: null } },
			{ $unset: { lockedAt: true } }
		);
	}

	async lockJob(job: IJobParameters): Promise<IJobParameters | undefined> {
		if (!job._id) return undefined;

		// Query to run against collection to see if we need to lock it
		const criteria: Filter<MongoJobDocument> = {
			_id: new ObjectId(job._id.toString()),
			name: job.name,
			lockedAt: null as unknown as Date,
			nextRunAt: job.nextRunAt,
			disabled: { $ne: true }
		};

		// Update / options for the MongoDB query
		const update: UpdateFilter<MongoJobDocument> = { $set: { lockedAt: new Date() } };
		const options: FindOneAndUpdateOptions = {
			returnDocument: 'after',
			sort: this.connectOptions.sort
		};

		// Lock the job in MongoDB!
		const result = await this.collection.findOneAndUpdate(
			criteria,
			update,
			options
		);

		if (!result) return undefined;

		// Convert MongoDB ObjectId to JobId
		return {
			...result,
			_id: toJobId(result._id.toHexString())
		};
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
		const JOB_PROCESS_WHERE_QUERY: Filter<MongoJobDocument> = {
			name: jobName,
			disabled: { $ne: true },
			$or: [
				{
					lockedAt: { $eq: null as unknown as Date },
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
		const JOB_PROCESS_SET_QUERY: UpdateFilter<MongoJobDocument> = { $set: { lockedAt: now } };

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
			JOB_RETURN_QUERY
		);

		if (!result) return undefined;

		// Convert MongoDB ObjectId to JobId
		return {
			...result,
			_id: toJobId(result._id.toHexString())
		};
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

	/**
	 * Convert MongoDB document to IJobParameters with JobId
	 */
	private toJobParameters<DATA = unknown>(doc: MongoJobDocument & { _id: ObjectId }): IJobParameters<DATA> {
		return {
			...doc,
			_id: toJobId(doc._id.toHexString())
		} as IJobParameters<DATA>;
	}

	async saveJobState(job: IJobParameters): Promise<void> {
		if (!job._id) {
			throw new Error('Cannot save job state without job ID');
		}
		const id = new ObjectId(job._id.toString());
		const $set = {
			lockedAt: (job.lockedAt && new Date(job.lockedAt)) || undefined,
			nextRunAt: (job.nextRunAt && new Date(job.nextRunAt)) || undefined,
			lastRunAt: (job.lastRunAt && new Date(job.lastRunAt)) || undefined,
			progress: job.progress,
			failReason: job.failReason,
			failCount: job.failCount,
			failedAt: job.failedAt && new Date(job.failedAt),
			lastFinishedAt: (job.lastFinishedAt && new Date(job.lastFinishedAt)) || undefined
		};

		log('[job %s] save job state: \n%O', job._id, $set);

		const result = await this.collection.updateOne(
			{ _id: id, name: job.name },
			{
				$set
			}
		);

		if (!result.acknowledged || result.matchedCount !== 1) {
			throw new Error(
				`job ${job._id} (name: ${job.name}) cannot be updated in the database, maybe it does not exist anymore?`
			);
		}
	}

	/**
	 * Save a job to the database (insert or update)
	 * @param job Job parameters to save
	 * @returns The saved job parameters with ID
	 */
	async saveJob<DATA = unknown>(job: IJobParameters<DATA>): Promise<IJobParameters<DATA>> {
		try {
			log('attempting to save a job');

			// Extract the ID and unique fields (not persisted directly)
			const { _id, unique, uniqueOpts, ...props } = job;

			// Add lastModifiedBy
			const propsWithModifier = {
				...props,
				lastModifiedBy: this.connectOptions.name
			};

			log('[job %s] set job props: \n%O', _id, propsWithModifier);

			// Grab current time and set default query options for MongoDB
			const now = new Date();
			const protect: Partial<MongoJobDocument> = {};
			let update: UpdateFilter<MongoJobDocument> = { $set: propsWithModifier };
			log('current time stored as %s', now.toISOString());

			// If the job already had an ID, then update the properties of the job
			if (_id) {
				log('job already has _id, calling findOneAndUpdate() using _id as query');
				const result = await this.collection.findOneAndUpdate(
					{ _id: new ObjectId(_id.toString()), name: props.name },
					update,
					{ returnDocument: 'after' }
				);
				if (!result) {
					// Job was removed, return original data unchanged
					log('job %s was not found for update, returning original data', _id);
					return job;
				}
				return this.toJobParameters(result as MongoJobDocument & { _id: ObjectId });
			}

			if (props.type === 'single') {
				// Job type set to 'single' so...
				log('job with type of "single" found');

				// If the nextRunAt time is older than the current time, "protect" that property
				if (props.nextRunAt && props.nextRunAt <= now) {
					log('job has a scheduled nextRunAt time, protecting that field from upsert');
					protect.nextRunAt = props.nextRunAt;
					delete (propsWithModifier as Partial<MongoJobDocument>).nextRunAt;
				}

				// If we have things to protect, set them in MongoDB using $setOnInsert
				if (Object.keys(protect).length > 0) {
					update.$setOnInsert = protect;
				}

				// Try an upsert - ensures only one job of this name exists
				log(`calling findOneAndUpdate(${props.name}) with job name and type of "single" as query`);
				const result = await this.collection.findOneAndUpdate(
					{
						name: props.name,
						type: 'single'
					},
					update,
					{
						upsert: true,
						returnDocument: 'after'
					}
				);
				log(`findOneAndUpdate(${props.name}) with type "single" completed`);
				return this.toJobParameters(result as MongoJobDocument & { _id: ObjectId });
			}

			if (unique) {
				// Upsert based on the 'unique' query object
				const query: Filter<MongoJobDocument> = { ...unique } as Filter<MongoJobDocument>;
				query.name = props.name;
				if (uniqueOpts?.insertOnly) {
					update = { $setOnInsert: propsWithModifier };
				}

				log('calling findOneAndUpdate() with unique object as query: \n%O', query);
				const result = await this.collection.findOneAndUpdate(query, update, {
					upsert: true,
					returnDocument: 'after'
				});
				return this.toJobParameters(result as MongoJobDocument & { _id: ObjectId });
			}

			// Insert new job
			log(
				'using default behavior, inserting new job via insertOne() with props that were set: \n%O',
				propsWithModifier
			);
			const result = await this.collection.insertOne(propsWithModifier as MongoJobDocument);
			return this.toJobParameters({
				_id: result.insertedId,
				...propsWithModifier
			} as MongoJobDocument & { _id: ObjectId });
		} catch (error) {
			log('saveJob() received an error, job was not updated/created');
			throw error;
		}
	}
}
