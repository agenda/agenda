import { expect, describe, it, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { Db, MongoClient } from 'mongodb';
import { randomUUID } from 'crypto';
import { InMemoryNotificationChannel } from 'agenda';
import { MongoBackend, MongoJobRepository } from '../src/index.js';
import { fullAgendaTestSuite } from 'agenda/testing';

/**
 * MongoDB backend tests.
 *
 * The test setup (setup.ts) automatically starts a MongoMemoryServer
 * instance and sets MONGO_URI environment variable.
 */

const TEST_COLLECTION = 'agendaJobs';

// Helper to create a fresh database connection (used by MongoDB-specific tests)
async function createTestDb(): Promise<{ db: Db; client: MongoClient; disconnect: () => Promise<void> }> {
	const baseUri = process.env.MONGO_URI;
	if (!baseUri) {
		throw new Error('MONGO_URI not set. Ensure global setup is configured.');
	}

	const dbName = `agenda_test_${randomUUID().replace(/-/g, '')}`;
	const uri = `${baseUri.replace(/\/$/, '')}/${dbName}`;
	const client = await MongoClient.connect(uri);
	const db = client.db(dbName);

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
	sharedDbUri = `${baseUri.replace(/\/$/, '')}/${dbName}`;

	const client = await MongoClient.connect(sharedDbUri);
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
		it('should support object queries for job data', async () => {
			const jobData = { nested: { key: 'value' }, array: [1, 2, 3] };

			await backend.repository.saveJob({
				name: 'data-test',
				priority: 0,
				nextRunAt: new Date(),
				type: 'normal',
				data: jobData
			}, undefined);

			// MongoDB requires exact match on data field
			const result = await backend.repository.queryJobs({
				data: jobData
			});

			expect(result.total).toBe(1);
			expect(result.jobs[0].data).toEqual(jobData);
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

			console.log('SAVED', jobs, await db.listCollections());
			const indexes = await db.collection(testCollection).indexes();
			console.log('SAVED');
			// Should have _id and findAndLockNextJobIndex
			expect(indexes.length).toBeGreaterThanOrEqual(2);
			const indexNames = indexes.map(i => i.name);
			expect(indexNames).toContain('_id_');
			expect(indexNames).toContain('findAndLockNextJobIndex');

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
