import { expect, describe, it, beforeAll, afterAll, beforeEach, afterEach, assert, vi } from 'vitest';
import { Db, DbOptions, MongoClient, ObjectId } from 'mongodb';
import { randomUUID } from 'crypto';
import { Agenda, Job, InMemoryNotificationChannel } from 'agenda';
import { MongoBackend, MongoJobRepository, MongoJobLogger } from '../src/index.js';
import { fullAgendaTestSuite, jobLoggerTestSuite } from 'agenda/testing';
import { testMongoClientOptions } from './helpers/testMongoClientOptions.js';

/**
 * MongoDB backend tests.
 *
 * The test setup (setup.ts) automatically starts a MongoMemoryServer
 * instance and sets MONGO_URI environment variable.
 */

const TEST_COLLECTION = 'agendaJobs';

// Helper to create a fresh database connection (used by MongoDB-specific tests)
async function createTestDb(options?: DbOptions): Promise<{ db: Db; client: MongoClient; disconnect: () => Promise<void> }> {
	const baseUri = process.env.MONGO_URI;
	if (!baseUri) {
		throw new Error('MONGO_URI not set. Ensure global setup is configured.');
	}

	const dbName = `agenda_test_${randomUUID().replace(/-/g, '')}`;

	// Parse the URI to properly insert the database name before query params
	// MongoMemoryReplSet returns URIs like: mongodb://127.0.0.1:22261/?replicaSet=testset
	const url = new URL(baseUri);
	url.pathname = `/${dbName}`;
	const uri = url.toString();

	const client = await MongoClient.connect(uri, testMongoClientOptions);
	const db = client.db(dbName, options);

	return {
		db,
		client,
		disconnect: async () => {
			await db.dropDatabase();
			await client.close();
		}
	};
}

// ============================================================================
// Shared Database Connection
// ============================================================================

let sharedDb: Db;
let sharedDbUri: string;
let disconnectShared: () => Promise<void>;

beforeAll(async () => {
	const baseUri = process.env.MONGO_URI;
	if (!baseUri) {
		throw new Error('MONGO_URI not set. Ensure global setup is configured.');
	}
	const dbName = `agenda_test_${randomUUID().replace(/-/g, '')}`;

	// Parse the URI to properly insert the database name before query params
	// MongoMemoryReplSet returns URIs like: mongodb://127.0.0.1:22261/?replicaSet=testset
	const url = new URL(baseUri);
	url.pathname = `/${dbName}`;
	sharedDbUri = url.toString();

	const client = await MongoClient.connect(sharedDbUri, testMongoClientOptions);
	sharedDb = client.db(dbName);
	disconnectShared = async () => {
		await sharedDb.dropDatabase();
		await client.close();
	};
});

afterAll(async () => {
	await disconnectShared();
});

// ============================================================================
// Full Agenda Test Suite
// ============================================================================

fullAgendaTestSuite({
	name: 'MongoBackend',
	createBackend: async () => {
		const backend = new MongoBackend({
			mongo: sharedDb,
			collection: TEST_COLLECTION
		});
		await backend.connect();
		return backend;
	},
	cleanupBackend: async () => {
		// Don't disconnect - we're sharing the connection
	},
	clearJobs: async () => {
		await sharedDb.collection(TEST_COLLECTION).deleteMany({});
	},
	// Test with notification channel
	createNotificationChannel: async () => {
		return new InMemoryNotificationChannel();
	},
	cleanupNotificationChannel: async channel => {
		if (channel.state !== 'disconnected') {
			await channel.disconnect();
		}
	},
	// Fork mode configuration - env is evaluated at test time via getter
	forkHelper: {
		path: './test/helpers/forkHelper.ts',
		options: {
			execArgv: ['--import', 'tsx'],
			get env() {
				return {
					...process.env,
					DB_CONNECTION: sharedDbUri,
					DB_COLLECTION: TEST_COLLECTION
				};
			}
		}
	}
});

// ============================================================================
// MongoDB-Specific Tests
// ============================================================================

describe('MongoBackend', () => {
	let db: Db;
	let disconnectDb: () => Promise<void>;
	let backend: MongoBackend;

	beforeAll(async () => {
		const result = await createTestDb();
		db = result.db;
		disconnectDb = result.disconnect;
	});

	afterAll(async () => {
		await disconnectDb();
	});

	beforeEach(async () => {
		backend = new MongoBackend({
			mongo: db,
			collection: TEST_COLLECTION
		});
		await backend.connect();
	});

	afterEach(async () => {
		await backend.disconnect();
		await db.collection(TEST_COLLECTION).deleteMany({});
	});

	describe('backend interface', () => {
		it('should provide repository', () => {
			expect(backend.repository).toBeDefined();
			expect(backend.repository).toBeInstanceOf(MongoJobRepository);
		});

		it('should not provide notification channel', () => {
			expect(backend.notificationChannel).toBeUndefined();
		});
	});

	describe('existing connection support', () => {
		it('should accept an existing Db instance', async () => {
			const { db: existingDb, disconnect } = await createTestDb();

			const backendWithDb = new MongoBackend({
				mongo: existingDb,
				collection: TEST_COLLECTION + '_existing'
			});

			await backendWithDb.connect();
			expect(backendWithDb.repository).toBeDefined();

			// Save and retrieve a job
			const saved = await backendWithDb.repository.saveJob({
				name: 'existing-db-test',
				priority: 0,
				nextRunAt: new Date(),
				type: 'normal',
				data: {}
			}, undefined);
			expect(saved._id).toBeDefined();

			await backendWithDb.disconnect();
			await disconnect();
		});
	});

	describe('MongoDB-specific features', () => {
		it('should support the documented queryJobs -> new Job() rehydration pattern', async () => {
			// Pattern documented in docs/migration-guide-v6.md (#1716): queryJobs
			// returns plain objects; rehydrate with new Job(agenda, jobData) to
			// modify and save like a v5 Job instance.
			const agenda = new Agenda({ backend });
			agenda.on('error', () => {});

			await backend.repository.saveJob({
				name: 'rehydrate-test',
				priority: 0,
				nextRunAt: new Date(),
				type: 'normal',
				data: { prop: false }
			}, undefined);

			const { jobs } = await agenda.queryJobs({ name: 'rehydrate-test', data: { prop: false } });
			expect(jobs).toHaveLength(1);

			// eslint-disable-next-line @typescript-eslint/no-unused-vars -- strip the computed state field
			const { state, ...jobData } = jobs[0];
			const job = new Job(agenda, jobData);
			(job.attrs.data as { prop: boolean }).prop = true;
			job.schedule(new Date(Date.now() + 20 * 60 * 1000));
			await job.save();

			const doc = await db.collection(TEST_COLLECTION).findOne({ name: 'rehydrate-test' });
			assert(doc !== null, 'Job should exist in the collection');
			expect(doc.data).toEqual({ prop: true });
			expect(doc.nextRunAt.getTime()).toBeGreaterThan(Date.now() + 19 * 60 * 1000);
			// the computed state field must not leak into the stored document
			expect(doc.state).toBeUndefined();
		});

		it('should support partial matching on job data', async () => {
			const jobData = { nested: { key: 'value' }, array: [1, 2, 3], extra: 'field' };

			await backend.repository.saveJob({
				name: 'data-test',
				priority: 0,
				nextRunAt: new Date(),
				type: 'normal',
				data: jobData
			}, undefined);

			// Partial match: query with a subset of the data fields
			const result = await backend.repository.queryJobs({
				data: { nested: { key: 'value' } }
			});

			expect(result.total).toBe(1);
			expect(result.jobs[0].data).toEqual(jobData);
		});

		it('should support partial matching with top-level data fields', async () => {
			await backend.repository.saveJob({
				name: 'partial-test',
				priority: 0,
				nextRunAt: new Date(),
				type: 'normal',
				data: { searchField: 'searchValue', anotherField: 'anotherValue' }
			}, undefined);

			const result = await backend.repository.queryJobs({
				data: { searchField: 'searchValue' }
			});

			expect(result.total).toBe(1);
			expect(result.jobs[0].data).toEqual({ searchField: 'searchValue', anotherField: 'anotherValue' });
		});

		it('should support ObjectId values when filtering job data', async () => {
			const userId = new ObjectId();

			await backend.repository.saveJob({
				name: 'objectid-data-test',
				priority: 0,
				nextRunAt: new Date(),
				type: 'normal',
				data: {
					userId,
					extra: 'field'
				}
			}, undefined);

			const result = await backend.repository.queryJobs({
				data: {
					userId
				}
			});

			expect(result.total).toBe(1);
			expect(result.jobs[0].data).toEqual({
				userId,
				extra: 'field'
			});

			const removed = await backend.repository.removeJobs({
				name: 'objectid-data-test',
				data: {
					userId
				}
			});

			expect(removed).toBe(1);

			const afterRemove = await backend.repository.queryJobs({
				name: 'objectid-data-test'
			});

			expect(afterRemove.total).toBe(0);
		});

		it('should support array values when filtering job data', async () => {
			const tags = ['first', 'second'];

			await backend.repository.saveJob({
				name: 'array-data-test',
				priority: 0,
				nextRunAt: new Date(),
				type: 'normal',
				data: {
					tags,
					extra: 'field'
				}
			}, undefined);

			const result = await backend.repository.queryJobs({
				data: {
					tags
				}
			});

			expect(result.total).toBe(1);
			expect(result.jobs[0].data).toEqual({
				tags,
				extra: 'field'
			});

			const removed = await backend.repository.removeJobs({
				name: 'array-data-test',
				data: {
					tags
				}
			});

			expect(removed).toBe(1);
		});

		it('should support Date values when filtering job data', async () => {
			const scheduledAt = new Date('2026-05-05T12:36:42.952Z');

			await backend.repository.saveJob({
				name: 'date-data-test',
				priority: 0,
				nextRunAt: new Date(),
				type: 'normal',
				data: {
					scheduledAt,
					extra: 'field'
				}
			}, undefined);

			const result = await backend.repository.queryJobs({
				data: {
					scheduledAt
				}
			});

			expect(result.total).toBe(1);
			expect(result.jobs[0].data).toEqual({
				scheduledAt,
				extra: 'field'
			});

			const removed = await backend.repository.removeJobs({
				name: 'date-data-test',
				data: {
					scheduledAt
				}
			});

			expect(removed).toBe(1);
		});

		it('should handle concurrent job locking with findOneAndUpdate', async () => {
			await Promise.all([
				backend.repository.saveJob({
					name: 'concurrent-test',
					priority: 0,
					nextRunAt: new Date(Date.now() - 1000),
					type: 'normal',
					data: { id: 1 }
				}, undefined),
				backend.repository.saveJob({
					name: 'concurrent-test',
					priority: 0,
					nextRunAt: new Date(Date.now() - 1000),
					type: 'normal',
					data: { id: 2 }
				}, undefined)
			]);

			const now = new Date();
			const nextScanAt = new Date(now.getTime() + 5000);
			const lockDeadline = new Date(now.getTime() - 600000);

			const [next1, next2] = await Promise.all([
				backend.repository.getNextJobToRun('concurrent-test', nextScanAt, lockDeadline, now, undefined),
				backend.repository.getNextJobToRun('concurrent-test', nextScanAt, lockDeadline, now, undefined)
			]);

			expect(next1).toBeDefined();
			expect(next2).toBeDefined();
			expect(next1!._id).not.toBe(next2!._id);
		});

		it('should use collection specified in config', async () => {
			const collections = await db.listCollections().toArray();
			const collectionNames = collections.map(c => c.name);
			expect(collectionNames).toContain(TEST_COLLECTION);
		});

		it('should explicitly set optional properties to null and avoid relying on the "ignoreUndefined" flag', async () => {
			const {
				db: dbWithIgnoreUndefined,
				disconnect: disconnectDbWithIgnoreUndefined
			} = await createTestDb({ ignoreUndefined: true });

			backend = new MongoBackend({
				mongo: dbWithIgnoreUndefined,
				collection: TEST_COLLECTION
			});

			await backend.connect();
			await backend.repository.saveJob({
				name: 'concurrent-test',
				priority: 0,
				nextRunAt: new Date(Date.now() - 1000),
				type: 'normal',
				data: { id: 1, ignoredField: undefined }
			}, undefined);

			const job = await dbWithIgnoreUndefined.collection(TEST_COLLECTION).findOne();

			assert(job !== null, 'Job should exist in the collection');
			expect(job.lockedAt).toBeNull();
			expect(job.lastFinishedAt).toBeNull();
			expect(job.failedAt).toBeNull();
			expect(job.failCount).toBeNull();
			expect(job.failReason).toBeNull();
			expect(job.repeatTimezone).toBeNull();
			expect(job.lastRunAt).toBeNull();
			expect(job.repeatInterval).toBeNull();
			expect(job.repeatAt).toBeNull();
			expect(job.disabled).toBeNull();
			expect(job.progress).toBeNull();
			expect(job.data.ignoredField).toBeUndefined();

			await disconnectDbWithIgnoreUndefined();
		});

		it('should clear nextRunAt via saveJobState so completed one-time jobs are not re-run (#1710)', async () => {
			const {
				db: dbWithIgnoreUndefined,
				disconnect: disconnectDbWithIgnoreUndefined
			} = await createTestDb({ ignoreUndefined: true });

			backend = new MongoBackend({
				mongo: dbWithIgnoreUndefined,
				collection: TEST_COLLECTION
			});

			await backend.connect();
			const saved = await backend.repository.saveJob({
				name: 'one-time-job',
				priority: 0,
				nextRunAt: new Date(Date.now() - 1000),
				type: 'normal',
				data: {}
			}, undefined);

			// Simulate what the job processor does on completion of a one-time job:
			// computeNextRunAt() sets nextRunAt to null, then saveJobState persists it
			await backend.repository.saveJobState({
				...saved,
				lockedAt: undefined,
				nextRunAt: null,
				lastRunAt: new Date(),
				lastFinishedAt: new Date()
			}, undefined);

			const doc = await dbWithIgnoreUndefined.collection(TEST_COLLECTION).findOne({ name: 'one-time-job' });
			assert(doc !== null, 'Job should exist in the collection');
			expect(doc.nextRunAt).toBeNull();
			expect(doc.lockedAt).toBeNull();
			expect(doc.lastRunAt).toBeInstanceOf(Date);
			expect(doc.lastFinishedAt).toBeInstanceOf(Date);

			// The completed job must no longer match the runnable-job query
			const now = new Date();
			const next = await backend.repository.getNextJobToRun(
				'one-time-job',
				new Date(now.getTime() + 5000),
				new Date(now.getTime() - 600000),
				now,
				undefined
			);
			expect(next).toBeUndefined();

			await disconnectDbWithIgnoreUndefined();
		});

		it('should coerce date-like values to Date in saveJobState', async () => {
			const saved = await backend.repository.saveJob({
				name: 'date-coercion-test',
				priority: 0,
				nextRunAt: new Date(Date.now() - 1000),
				type: 'normal',
				data: {}
			}, undefined);

			// Untyped (plain JS) callers may pass ISO strings for date fields;
			// saveJobState must coerce them so MongoDB stores real dates
			await backend.repository.saveJobState({
				...saved,
				nextRunAt: new Date().toISOString() as unknown as Date,
				lastRunAt: new Date().toISOString() as unknown as Date
			}, undefined);

			const doc = await db.collection(TEST_COLLECTION).findOne({ name: 'date-coercion-test' });
			assert(doc !== null, 'Job should exist in the collection');
			expect(doc.nextRunAt).toBeInstanceOf(Date);
			expect(doc.lastRunAt).toBeInstanceOf(Date);
		});

		it('should preserve startDate, endDate and skipDays when loading jobs from the database', async () => {
			const startDate = new Date('2026-01-01T00:00:00Z');
			const endDate = new Date('2026-12-31T23:59:59Z');
			const skipDays = [0, 6];

			const saved = await backend.repository.saveJob({
				name: 'date-constraint-test',
				priority: 0,
				nextRunAt: new Date(Date.now() - 1000),
				type: 'normal',
				repeatInterval: '1 day',
				startDate,
				endDate,
				skipDays,
				data: {}
			}, undefined);

			// Read back through every load path — the constraints must survive
			const byId = await backend.repository.getJobById(saved._id!.toString());
			assert(byId !== null, 'Job should be found by id');
			expect(byId.startDate).toEqual(startDate);
			expect(byId.endDate).toEqual(endDate);
			expect(byId.skipDays).toEqual(skipDays);

			const { jobs } = await backend.repository.queryJobs({ name: 'date-constraint-test' });
			expect(jobs).toHaveLength(1);
			expect(jobs[0].startDate).toEqual(startDate);
			expect(jobs[0].endDate).toEqual(endDate);
			expect(jobs[0].skipDays).toEqual(skipDays);

			const now = new Date();
			const next = await backend.repository.getNextJobToRun(
				'date-constraint-test',
				new Date(now.getTime() + 5000),
				new Date(now.getTime() - 600000),
				now,
				undefined
			);
			assert(next !== undefined, 'Job should be returned by getNextJobToRun');
			expect(next.startDate).toEqual(startDate);
			expect(next.endDate).toEqual(endDate);
			expect(next.skipDays).toEqual(skipDays);
		});
	});

	describe('queryJobs pagination', () => {
		it('should push skip/limit to the database when no state filter is set', async () => {
			const total = 200;
			const docs = Array.from({ length: total }, (_, i) => ({
				name: 'pagination-test',
				priority: 0,
				nextRunAt: new Date(),
				type: 'normal',
				data: { i }
			}));
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw docs for insertMany
			await db.collection(TEST_COLLECTION).insertMany(docs as any);

			// Wrap find() on the repository's own collection to capture how many
			// documents the returned cursor materializes via toArray().
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- access internal collection
			const collection = (backend.repository as any).collection as ReturnType<Db['collection']>;
			const originalFind = collection.find.bind(collection);
			let materialized = -1;
			const findSpy = vi
				.spyOn(collection, 'find')
				// eslint-disable-next-line @typescript-eslint/no-explicit-any -- pass-through spy
				.mockImplementation((...args: any[]) => {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any -- pass-through spy
					const cursor = (originalFind as any)(...args);
					const originalToArray = cursor.toArray.bind(cursor);
					cursor.toArray = async () => {
						const result = await originalToArray();
						materialized = result.length;
						return result;
					};
					return cursor;
				});

			try {
				const result = await backend.repository.queryJobs({
					name: 'pagination-test',
					limit: 10
				});

				expect(result.jobs).toHaveLength(10);
				expect(result.total).toBe(total);
				// The cursor must only materialize the page, not the whole collection.
				expect(materialized).toBe(10);
			} finally {
				findSpy.mockRestore();
			}
		});
	});

	describe('ensureIndex option', () => {
		it('should not create index when ensureIndex is false', async () => {
			const testCollection = TEST_COLLECTION + '_no_index';

			const backendNoIndex = new MongoBackend({
				mongo: db,
				collection: testCollection,
				ensureIndex: false
			});
			await backendNoIndex.connect();

			// Save a job
			await backendNoIndex.repository.saveJob({
				name: 'index-test',
				priority: 0,
				nextRunAt: new Date(),
				type: 'normal',
				data: {}
			}, undefined);

			const indexes = await db.collection(testCollection).indexes();
			// Should only have _id index
			expect(indexes).toHaveLength(1);
			expect(indexes[0].name).toBe('_id_');

			await backendNoIndex.disconnect();
			await db.collection(testCollection).drop();
		});

		it('should create findAndLockNextJobIndex when ensureIndex is true', async () => {
			const testCollection = TEST_COLLECTION + '_with_index';
			const backendWithIndex = new MongoBackend({
				mongo: db,
				collection: testCollection,
				ensureIndex: true
			});
			await backendWithIndex.connect();

			// Save a job to ensure collection exists
			await backendWithIndex.repository.saveJob({
				name: 'index-test',
				priority: 0,
				nextRunAt: new Date(),
				type: 'normal',
				data: {}
			}, undefined);

			// Verify the job was saved (this ensures the collection exists)
			const jobs = await backendWithIndex.repository.queryJobs({ name: 'index-test' });
			expect(jobs.total).toBe(1);

			const indexes = await db.collection(testCollection).indexes();
			// Should have _id and the indexes created by MongoBackend
			expect(indexes.length).toBeGreaterThanOrEqual(5);
			const indexNames = indexes.map(i => i.name);
			expect(indexNames).toContain('_id_');
			expect(indexNames).toContain('findAndLockNextJobIndex');
			expect(indexNames).toContain('nameIdx');
			expect(indexNames).toContain('nextRunAtIdx');
			expect(indexNames).toContain('nameTypeIdx');

			await backendWithIndex.disconnect();
			await db.collection(testCollection).drop();
		});

		it('should not throw when creating two backends with ensureIndex true', async () => {
			const testCollection = TEST_COLLECTION + '_dual_index';

			const backend1 = new MongoBackend({
				mongo: db,
				collection: testCollection,
				ensureIndex: true
			});
			await backend1.connect();

			await backend1.repository.saveJob({
				name: 'dual-index-test',
				priority: 0,
				nextRunAt: new Date(),
				type: 'normal',
				data: {}
			}, undefined);

			// Creating second backend with same collection should not throw
			const backend2 = new MongoBackend({
				mongo: db,
				collection: testCollection,
				ensureIndex: true
			});
			await backend2.connect();

			await backend2.repository.saveJob({
				name: 'dual-index-test-2',
				priority: 0,
				nextRunAt: new Date(),
				type: 'normal',
				data: {}
			}, undefined);

			await backend1.disconnect();
			await backend2.disconnect();
			await db.collection(testCollection).drop();
		});
	});
});

// ============================================================================
// Unit Tests (no database required)
// ============================================================================

describe('MongoBackend unit tests', () => {
	it('should accept connection string config', () => {
		const backend = new MongoBackend({
			address: 'mongodb://localhost/agenda'
		});
		expect(backend.repository).toBeDefined();
		expect(backend.notificationChannel).toBeUndefined();
	});

	it('should accept mongo db config', () => {
		// Create a mock Db object
		const mockDb = {} as Db;
		const backend = new MongoBackend({
			mongo: mockDb
		});
		expect(backend.repository).toBeDefined();
	});

	describe('connection string validation', () => {
		it('should accept mongodb:// protocol', () => {
			const backend = new MongoBackend({
				address: 'mongodb://localhost:27017/agenda'
			});
			expect(backend.repository).toBeDefined();
		});

		it('should accept mongodb+srv:// protocol', () => {
			const backend = new MongoBackend({
				address: 'mongodb+srv://user:pass@cluster.mongodb.net/agenda'
			});
			expect(backend.repository).toBeDefined();
		});

		it('should accept mongodb:// with authentication', () => {
			const backend = new MongoBackend({
				address: 'mongodb://user:password@localhost:27017/agenda'
			});
			expect(backend.repository).toBeDefined();
		});

		it('should accept mongodb:// with replica set', () => {
			const backend = new MongoBackend({
				address: 'mongodb://host1:27017,host2:27017,host3:27017/agenda?replicaSet=myReplicaSet'
			});
			expect(backend.repository).toBeDefined();
		});
	});
});

// ============================================================================
// MongoJobLogger Tests (shared test suite)
// ============================================================================

jobLoggerTestSuite({
	name: 'MongoJobLogger',
	createLogger: async () => {
		const logger = new MongoJobLogger({ db: sharedDb, collectionName: 'agenda_logs' });
		return logger;
	},
	cleanupLogger: async (logger) => {
		await logger.clearLogs();
	}
});
