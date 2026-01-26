import assert from 'node:assert';
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
	UpdateFilter,
	WithId
} from 'mongodb';
import type {
	JobParameters,
	JobId,
	JobsQueryOptions,
	JobsResult,
	JobsOverview,
	JobWithState,
	JobsSort,
	JobRepository,
	JobRepositoryOptions,
	RemoveJobsOptions,
	SortDirection
} from 'agenda';
import { toJobId, computeJobState } from 'agenda';
import type { MongoJobRepositoryConfig } from './types.js';
import { hasMongoProtocol } from './hasMongoProtocol.js';

const log = debug('agenda:mongo:repository');

/**
 * Escape special regex characters in a string to treat it as literal text
 */
function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function computeJobObj<DATA = unknown>(job: WithId<MongoJobDocument>): JobParameters<DATA> & { _id: JobId } {
	return {
		_id: toJobId(job._id!.toHexString()),
		name: job.name,
		priority: job.priority,
		nextRunAt: job.nextRunAt,
		type: job.type,
		data: job.data as DATA,
		lockedAt: job.lockedAt,
		lastFinishedAt: job.lastFinishedAt,
		failedAt: job.failedAt || undefined,
		failCount: job.failCount || undefined,
		failReason: job.failReason || undefined,
		repeatTimezone: job.repeatTimezone,
		lastRunAt: job.lastRunAt,
		repeatInterval: job.repeatInterval,
		repeatAt: job.repeatAt,
		disabled: job.disabled,
		progress: job.progress,
		unique: job.unique,
		uniqueOpts: job.uniqueOpts,
		lastModifiedBy: job.lastModifiedBy,
		fork: job.fork,
		debounceStartedAt: job.debounceStartedAt
	};
}

/**
 * Internal MongoDB document type with ObjectId for _id
 * This is what's actually stored in MongoDB, separate from the public JobParameters interface
 */
type MongoJobDocument = Omit<JobParameters, '_id'> & { _id?: ObjectId };

/**
 * @class
 * MongoDB implementation of JobRepository
 */
export class MongoJobRepository implements JobRepository {
	collection!: Collection<MongoJobDocument>;
	private mongoClient?: MongoClient;
	private ownsConnection: boolean = false;

	constructor(private connectOptions: MongoJobRepositoryConfig) {
		this.connectOptions.sort = this.connectOptions.sort || { nextRunAt: 'asc', priority: 'desc' };
		// Track if we own the connection (i.e., we created it from a connection string)
		this.ownsConnection = !('mongo' in connectOptions);
	}

	private async createConnection(): Promise<Db> {
		const { connectOptions } = this;
		if ('mongo' in connectOptions) {
			log('using passed in mongo connection');
			return connectOptions.mongo;
		}

		if ('db' in connectOptions && connectOptions.db) {
			log('using database config', connectOptions);
			return this.database(connectOptions.db.address, connectOptions.db.options);
		}

		throw new Error('invalid db config, or db config not found');
	}

	async getJobById(id: string): Promise<JobParameters | null> {
		const doc = await this.collection.findOne({ _id: new ObjectId(id) });
		if (!doc) return null;
		// Convert MongoDB ObjectId to JobId
		return computeJobObj(doc);
	}

	/**
	 * Convert a SortDirection value to MongoDB's numeric sort direction
	 */
	private toMongoSortDirection(dir: SortDirection): 1 | -1 {
		return dir === 'asc' ? 1 : -1;
	}

	/**
	 * Convert generic sort options to MongoDB sort
	 */
	private toMongoSort(sort?: JobsSort): Sort {
		if (!sort) {
			return { nextRunAt: -1, lastRunAt: -1 };
		}
		const mongoSort: Record<string, 1 | -1> = {};
		if (sort.nextRunAt !== undefined)
			mongoSort.nextRunAt = this.toMongoSortDirection(sort.nextRunAt);
		if (sort.lastRunAt !== undefined)
			mongoSort.lastRunAt = this.toMongoSortDirection(sort.lastRunAt);
		if (sort.lastFinishedAt !== undefined)
			mongoSort.lastFinishedAt = this.toMongoSortDirection(sort.lastFinishedAt);
		if (sort.priority !== undefined) mongoSort.priority = this.toMongoSortDirection(sort.priority);
		if (sort.name !== undefined) mongoSort.name = this.toMongoSortDirection(sort.name);
		if (sort.data !== undefined) mongoSort.data = this.toMongoSortDirection(sort.data);
		return Object.keys(mongoSort).length > 0 ? mongoSort : { nextRunAt: -1, lastRunAt: -1 };
	}

	/**
	 * Query jobs with database-agnostic options.
	 * Handles state computation and filtering internally.
	 */
	async queryJobs(options: JobsQueryOptions = {}): Promise<JobsResult> {
		const {
			name,
			names,
			state,
			id,
			ids,
			search,
			data,
			includeDisabled = true,
			sort,
			skip = 0,
			limit = 0
		} = options;
		const now = new Date();

		// Build MongoDB query from options
		const query: Filter<MongoJobDocument> = {};

		// Validate name is a string to prevent query operator injection
		if (name && typeof name === 'string') {
			query.name = name;
		} else if (names && Array.isArray(names) && names.length > 0) {
			// Filter to only valid strings
			const validNames = names.filter((n): n is string => typeof n === 'string');
			if (validNames.length > 0) {
				query.name = { $in: validNames };
			}
		}

		if (id && typeof id === 'string') {
			try {
				query._id = new ObjectId(id);
			} catch {
				return { jobs: [], total: 0 };
			}
		} else if (ids && Array.isArray(ids) && ids.length > 0) {
			try {
				const validIds = ids.filter((i): i is string => typeof i === 'string');
				if (validIds.length > 0) {
					query._id = { $in: validIds.map(i => new ObjectId(i)) };
				}
			} catch {
				return { jobs: [], total: 0 };
			}
		}

		// Validate search is a string and escape regex metacharacters
		if (search && typeof search === 'string' && search.length > 0) {
			query.name = { $regex: escapeRegex(search), $options: 'i' };
		}

		if (data !== undefined) {
			query.data = data as JobParameters['data'];
		}

		if (!includeDisabled) {
			query.disabled = { $ne: true };
		}

		// Fetch jobs
		const allJobs = await this.collection.find(query).sort(this.toMongoSort(sort)).toArray();

		// Compute states and filter by state if specified
		let jobsWithState: JobWithState[] = allJobs
			.map(job => {
				const jobOb = computeJobObj(job);
				return {
					...jobOb,
					state: computeJobState(jobOb, now)
				};
			})
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
	async getJobsOverview(): Promise<JobsOverview[]> {
		const now = new Date();
		const names = await this.getDistinctJobNames();

		const overviews = await Promise.all(
			names.map(async name => {
				const jobs = await this.collection.find({ name }).toArray();
				const overview: JobsOverview = {
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
					const state = computeJobState(job as unknown as JobParameters, now);
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

	async removeJobs(options: RemoveJobsOptions): Promise<number> {
		const query: Filter<MongoJobDocument> = {};

		if (options.id) {
			const idStr = String(options.id);
			try {
				query._id = new ObjectId(idStr);
			} catch {
				return 0;
			}
		} else if (options.ids && Array.isArray(options.ids) && options.ids.length > 0) {
			try {
				query._id = { $in: options.ids.map(id => new ObjectId(String(id))) };
			} catch {
				return 0;
			}
		}

		// Validate name is a string to prevent query operator injection
		if (options.name && typeof options.name === 'string') {
			query.name = options.name;
		} else if (options.names && Array.isArray(options.names) && options.names.length > 0) {
			const validNames = options.names.filter((n): n is string => typeof n === 'string');
			if (validNames.length > 0) {
				query.name = { $in: validNames };
			}
		} else if (options.notNames && Array.isArray(options.notNames) && options.notNames.length > 0) {
			const validNotNames = options.notNames.filter((n): n is string => typeof n === 'string');
			if (validNotNames.length > 0) {
				query.name = { $nin: validNotNames };
			}
		}

		if (options.data !== undefined) {
			query.data = options.data as JobParameters['data'];
		}

		// If no criteria provided, don't delete anything
		if (Object.keys(query).length === 0) {
			log('removeJobs: skipping deleteMany without query', query);
			return 0;
		}

		const result = await this.collection.deleteMany(query);
		return result.deletedCount;
	}

	/**
	 * Build a MongoDB filter from RemoveJobsOptions
	 */
	private buildFilterFromOptions(options: RemoveJobsOptions): Filter<MongoJobDocument> | null {
		const query: Filter<MongoJobDocument> = {};

		if (options.id) {
			const idStr = String(options.id);
			try {
				query._id = new ObjectId(idStr);
			} catch {
				return null;
			}
		} else if (options.ids && Array.isArray(options.ids) && options.ids.length > 0) {
			try {
				query._id = { $in: options.ids.map(id => new ObjectId(String(id))) };
			} catch {
				return null;
			}
		}

		// Validate name is a string to prevent query operator injection
		if (options.name && typeof options.name === 'string') {
			query.name = options.name;
		} else if (options.names && Array.isArray(options.names) && options.names.length > 0) {
			const validNames = options.names.filter((n): n is string => typeof n === 'string');
			if (validNames.length > 0) {
				query.name = { $in: validNames };
			}
		} else if (options.notNames && Array.isArray(options.notNames) && options.notNames.length > 0) {
			const validNotNames = options.notNames.filter((n): n is string => typeof n === 'string');
			if (validNotNames.length > 0) {
				query.name = { $nin: validNotNames };
			}
		}

		if (options.data !== undefined) {
			query.data = options.data as JobParameters['data'];
		}

		// If no criteria provided, return null to indicate no operation
		if (Object.keys(query).length === 0) {
			return null;
		}

		return query;
	}

	async disableJobs(options: RemoveJobsOptions): Promise<number> {
		const query = this.buildFilterFromOptions(options);
		if (!query) {
			return 0;
		}

		const result = await this.collection.updateMany(query, { $set: { disabled: true } });
		return result.modifiedCount;
	}

	async enableJobs(options: RemoveJobsOptions): Promise<number> {
		const query = this.buildFilterFromOptions(options);
		if (!query) {
			return 0;
		}

		const result = await this.collection.updateMany(query, { $set: { disabled: false } });
		return result.modifiedCount;
	}

	async unlockJob(job: JobParameters): Promise<void> {
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
		// Unlock jobs by ID regardless of nextRunAt status.
		// When a one-time job starts running, nextRunAt becomes null,
		// but we still want to unlock it when stop() is called.
		await this.collection.updateMany({ _id: { $in: objectIds } }, { $unset: { lockedAt: true } });
	}

	async lockJob(
		job: JobParameters,
		options: JobRepositoryOptions | undefined
	): Promise<JobParameters | undefined> {
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
		const update: UpdateFilter<MongoJobDocument> = {
			$set: { lockedAt: new Date(), lastModifiedBy: options?.lastModifiedBy }
		};
		const findOptions: FindOneAndUpdateOptions = {
			returnDocument: 'after',
			sort: this.connectOptions.sort
		};

		// Lock the job in MongoDB!
		const result = await this.collection.findOneAndUpdate(criteria, update, findOptions);

		if (!result) return undefined;

		// Convert MongoDB ObjectId to JobId
		return computeJobObj(result);
	}

	async getNextJobToRun(
		jobName: string,
		nextScanAt: Date,
		lockDeadline: Date,
		now: Date | undefined,
		options: JobRepositoryOptions | undefined
	): Promise<JobParameters | undefined> {
		const lockTime = now ?? new Date();

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
		const JOB_PROCESS_SET_QUERY: UpdateFilter<MongoJobDocument> = {
			$set: { lockedAt: lockTime, lastModifiedBy: options?.lastModifiedBy }
		};

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
		return computeJobObj(result);
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

		if (this.connectOptions.ensureIndex ?? true) {
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

		this.mongoClient = await MongoClient.connect(connectionString, {
			...options
		});

		return this.mongoClient.db();
	}

	async disconnect(): Promise<void> {
		if (this.ownsConnection && this.mongoClient) {
			log('closing owned MongoDB connection');
			await this.mongoClient.close();
			this.mongoClient = undefined;
		}
	}

	async saveJobState(
		job: JobParameters,
		options: JobRepositoryOptions | undefined
	): Promise<void> {
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
			lastFinishedAt: (job.lastFinishedAt && new Date(job.lastFinishedAt)) || undefined,
			lastModifiedBy: options?.lastModifiedBy
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
	async saveJob<DATA = unknown>(
		job: JobParameters<DATA>,
		options: JobRepositoryOptions | undefined
	): Promise<JobParameters<DATA>> {
		try {
			log('attempting to save a job');

			// Extract the ID and unique fields (not persisted directly)
			const { _id, unique, uniqueOpts, ...props } = job;

			// Add lastModifiedBy
			const propsWithModifier = {
				...props,
				lastModifiedBy: options?.lastModifiedBy
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
				return computeJobObj<DATA>(result);
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
				assert(result, 'findOneAndUpdate with upsert should always return a document');
				return computeJobObj(result);
			}

			if (unique) {
				// Upsert based on the 'unique' query object
				const query: Filter<MongoJobDocument> = { ...unique } as Filter<MongoJobDocument>;
				query.name = props.name;

				const debounce = uniqueOpts?.debounce;

				if (uniqueOpts?.insertOnly && !debounce) {
					update = { $setOnInsert: propsWithModifier };
				}

				// Handle debounce logic
				if (debounce) {
					log('handling debounce with delay: %dms, strategy: %s', debounce.delay, debounce.strategy || 'trailing');

					// First, check if a matching job already exists
					const existingJob = await this.collection.findOne(query);

					if (existingJob) {
						// Job exists - apply debounce logic
						const debounceStartedAt = existingJob.debounceStartedAt ?? now;
						const timeSinceStart = now.getTime() - debounceStartedAt.getTime();

						if (debounce.strategy === 'leading') {
							// Leading: keep original nextRunAt, just update data
							// Don't change nextRunAt - the job runs on its original schedule
							log('leading debounce: keeping original nextRunAt, updating data only');
							const leadingUpdate: UpdateFilter<MongoJobDocument> = {
								$set: {
									...propsWithModifier,
									nextRunAt: existingJob.nextRunAt, // Preserve original
									debounceStartedAt: debounceStartedAt
								}
							};
							const result = await this.collection.findOneAndUpdate(query, leadingUpdate, {
								returnDocument: 'after'
							});
							assert(result, 'findOneAndUpdate should return a document');
							return computeJobObj(result);
						}

						// Trailing (default): push nextRunAt forward
						let newNextRunAt: Date;

						// Check maxWait - force execution if exceeded
						if (debounce.maxWait && timeSinceStart >= debounce.maxWait) {
							log('maxWait exceeded (%dms >= %dms), forcing immediate execution', timeSinceStart, debounce.maxWait);
							newNextRunAt = now;
							// Reset debounceStartedAt for the next cycle
							(propsWithModifier as Partial<MongoJobDocument>).debounceStartedAt = undefined;
						} else {
							// Normal debounce: schedule for delay ms from now
							newNextRunAt = new Date(now.getTime() + debounce.delay);
							(propsWithModifier as Partial<MongoJobDocument>).debounceStartedAt = debounceStartedAt;
							log('trailing debounce: rescheduling to %s', newNextRunAt.toISOString());
						}

						(propsWithModifier as Partial<MongoJobDocument>).nextRunAt = newNextRunAt;
						update = { $set: propsWithModifier };

						const result = await this.collection.findOneAndUpdate(query, update, {
							returnDocument: 'after'
						});
						assert(result, 'findOneAndUpdate should return a document');
						return computeJobObj(result);
					}

					// No existing job - this is a new job
					if (debounce.strategy === 'leading') {
						// Leading: execute immediately (keep nextRunAt as-is)
						log('leading debounce: new job, executing immediately');
						(propsWithModifier as Partial<MongoJobDocument>).debounceStartedAt = now;
					} else {
						// Trailing: schedule after delay
						const newNextRunAt = new Date(now.getTime() + debounce.delay);
						(propsWithModifier as Partial<MongoJobDocument>).nextRunAt = newNextRunAt;
						(propsWithModifier as Partial<MongoJobDocument>).debounceStartedAt = now;
						log('trailing debounce: new job, scheduling for %s', newNextRunAt.toISOString());
					}
				}

				log('calling findOneAndUpdate() with unique object as query: \n%O', query);
				const result = await this.collection.findOneAndUpdate(query, update, {
					upsert: true,
					returnDocument: 'after'
				});
				assert(result, 'findOneAndUpdate with upsert should always return a document');
				return computeJobObj(result);
			}

			// Insert new job
			log(
				'using default behavior, inserting new job via insertOne() with props that were set: \n%O',
				propsWithModifier
			);
			const result = await this.collection.insertOne(propsWithModifier as MongoJobDocument);
			return computeJobObj({
				_id: result.insertedId,
				...propsWithModifier
			});
		} catch (error) {
			log('saveJob() received an error, job was not updated/created');
			throw error;
		}
	}
}
