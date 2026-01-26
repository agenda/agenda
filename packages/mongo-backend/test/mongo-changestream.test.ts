import { expect, describe, it, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { Db, MongoClient } from 'mongodb';
import { randomUUID } from 'crypto';
import { MongoChangeStreamNotificationChannel } from '../src/index.js';

/**
 * MongoDB Change Stream Notification Channel tests.
 *
 * NOTE: MongoDB Change Streams require a replica set to function.
 * MongoMemoryServer can be configured with replica sets, but it's complex
 * and has known issues. Tests that require actual change stream functionality
 * are marked with .skip when running against a standalone instance.
 *
 * For full integration testing, use a real MongoDB replica set.
 */

const TEST_COLLECTION = 'agendaJobs';

// Helper to create a fresh database connection
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

// Helper to generate unique collection names for test isolation
function getUniqueCollectionName(): string {
	return `${TEST_COLLECTION}_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
}

// ============================================================================
// Unit Tests (no database connection required)
// ============================================================================

describe('MongoChangeStreamNotificationChannel unit tests', () => {
	it('should create channel with default config', () => {
		const channel = new MongoChangeStreamNotificationChannel();
		expect(channel.state).toBe('disconnected');
	});

	it('should create channel with custom collection name', () => {
		const channel = new MongoChangeStreamNotificationChannel({
			collection: 'customJobs'
		});
		expect(channel.state).toBe('disconnected');
	});

	it('should throw when connecting without db', async () => {
		const channel = new MongoChangeStreamNotificationChannel();
		await expect(channel.connect()).rejects.toThrow('requires a MongoDB database instance');
	});

	it('should allow setting db via setDb()', async () => {
		const channel = new MongoChangeStreamNotificationChannel();
		const mockDb = {} as Db;
		channel.setDb(mockDb);
		// No error thrown
	});

	it('should throw when setting db while connected', async () => {
		const { db, disconnect } = await createTestDb();

		try {
			const channel = new MongoChangeStreamNotificationChannel({ db });

			// Mock connected state by manually setting it
			// Note: This is a test-only scenario
			(channel as any)._state = 'connected';

			expect(() => channel.setDb({} as Db)).toThrow('Cannot set database while channel is connected');
		} finally {
			await disconnect();
		}
	});

	it('should return undefined resume token when not connected', () => {
		const channel = new MongoChangeStreamNotificationChannel();
		expect(channel.getResumeToken()).toBeUndefined();
	});

	it('should accept resume token in config', () => {
		const mockToken = { _data: 'test-token' };
		const channel = new MongoChangeStreamNotificationChannel({
			resumeToken: mockToken
		});
		expect(channel.getResumeToken()).toEqual(mockToken);
	});

	it('should default fullDocument to true', () => {
		const channel = new MongoChangeStreamNotificationChannel();
		expect((channel as any).useFullDocument).toBe(true);
	});

	it('should allow disabling fullDocument', () => {
		const channel = new MongoChangeStreamNotificationChannel({
			fullDocument: false
		});
		expect((channel as any).useFullDocument).toBe(false);
	});
});

// ============================================================================
// Integration Tests (require database but not replica set)
// ============================================================================

describe('MongoChangeStreamNotificationChannel integration tests', () => {
	let db: Db;
	let disconnectDb: () => Promise<void>;

	beforeAll(async () => {
		const result = await createTestDb();
		db = result.db;
		disconnectDb = result.disconnect;
	});

	afterAll(async () => {
		await disconnectDb();
	});

	describe('publish method', () => {
		it('should be a no-op (change streams auto-detect changes)', async () => {
			const channel = new MongoChangeStreamNotificationChannel({
				db,
				collection: getUniqueCollectionName()
			});

			// Even without connecting, publish should not throw
			// (it's a no-op for change streams)
			const notification = {
				jobId: 'test-id' as any,
				jobName: 'test-job',
				nextRunAt: new Date(),
				priority: 0,
				timestamp: new Date(),
				source: 'test' as const
			};

			// publish is a no-op, should not throw
			await channel.publish(notification);
		});
	});

	describe('disconnect', () => {
		it('should be safe to call disconnect when not connected', async () => {
			const channel = new MongoChangeStreamNotificationChannel({
				db,
				collection: getUniqueCollectionName()
			});

			// Should not throw
			await channel.disconnect();
			expect(channel.state).toBe('disconnected');
		});

		it('should be safe to call disconnect multiple times', async () => {
			const channel = new MongoChangeStreamNotificationChannel({
				db,
				collection: getUniqueCollectionName()
			});

			await channel.disconnect();
			await channel.disconnect();
			await channel.disconnect();

			expect(channel.state).toBe('disconnected');
		});
	});

	describe('handler management', () => {
		it('should allow subscribing handlers', async () => {
			const channel = new MongoChangeStreamNotificationChannel({
				db,
				collection: getUniqueCollectionName()
			});

			const handler = async () => {};
			const unsubscribe = channel.subscribe(handler);

			expect(typeof unsubscribe).toBe('function');

			// Cleanup
			unsubscribe();
		});

		it('should allow unsubscribing handlers', async () => {
			const channel = new MongoChangeStreamNotificationChannel({
				db,
				collection: getUniqueCollectionName()
			});

			const handler = async () => {};
			const unsubscribe = channel.subscribe(handler);

			unsubscribe();
			// No error should occur
		});
	});
});

// ============================================================================
// Change Stream Tests (require replica set - skipped in CI)
// ============================================================================

describe.skip('MongoChangeStreamNotificationChannel change stream tests', () => {
	/**
	 * These tests require a MongoDB replica set to function properly.
	 * MongoDB Change Streams only work with:
	 * - Replica sets
	 * - Sharded clusters
	 *
	 * MongoMemoryServer can be configured with replSet option, but it has
	 * known limitations and may not work reliably in all environments.
	 *
	 * To run these tests:
	 * 1. Start a MongoDB replica set locally or use MongoDB Atlas
	 * 2. Set MONGO_URI to your replica set connection string
	 * 3. Remove the .skip from this describe block
	 *
	 * Example with Docker:
	 * docker run -d -p 27017:27017 --name mongo-rs mongo:6 --replSet rs0
	 * docker exec mongo-rs mongosh --eval "rs.initiate()"
	 */

	let db: Db;
	let client: MongoClient;
	let channel: MongoChangeStreamNotificationChannel;
	let collectionName: string;

	beforeAll(async () => {
		const baseUri = process.env.MONGO_URI;
		if (!baseUri) {
			throw new Error('MONGO_URI not set');
		}

		const dbName = `agenda_test_${randomUUID().replace(/-/g, '')}`;
		const uri = `${baseUri.replace(/\/$/, '')}/${dbName}`;
		client = await MongoClient.connect(uri);
		db = client.db(dbName);
	});

	afterAll(async () => {
		if (db) {
			await db.dropDatabase();
		}
		if (client) {
			await client.close();
		}
	});

	beforeEach(async () => {
		collectionName = getUniqueCollectionName();
		channel = new MongoChangeStreamNotificationChannel({
			db,
			collection: collectionName
		});
	});

	afterEach(async () => {
		if (channel && channel.state !== 'disconnected') {
			await channel.disconnect();
		}
		if (db) {
			try {
				await db.collection(collectionName).drop();
			} catch {
				// Ignore if collection doesn't exist
			}
		}
	});

	it('should connect and watch collection', async () => {
		await channel.connect();
		expect(channel.state).toBe('connected');
	});

	it('should detect job inserts', async () => {
		await channel.connect();

		const notifications: any[] = [];
		channel.subscribe(async notification => {
			notifications.push(notification);
		});

		// Insert a job document
		await db.collection(collectionName).insertOne({
			name: 'test-job',
			nextRunAt: new Date(),
			priority: 0,
			type: 'normal',
			data: {}
		});

		// Wait for change stream to process
		await new Promise(resolve => setTimeout(resolve, 100));

		expect(notifications.length).toBe(1);
		expect(notifications[0].jobName).toBe('test-job');
	});

	it('should detect job updates', async () => {
		await channel.connect();

		// Insert a job first
		const result = await db.collection(collectionName).insertOne({
			name: 'update-test',
			nextRunAt: new Date(),
			priority: 0,
			type: 'normal',
			data: {}
		});

		const notifications: any[] = [];
		channel.subscribe(async notification => {
			notifications.push(notification);
		});

		// Clear initial insert notification
		await new Promise(resolve => setTimeout(resolve, 100));
		notifications.length = 0;

		// Update the job
		await db.collection(collectionName).updateOne(
			{ _id: result.insertedId },
			{ $set: { priority: 10 } }
		);

		// Wait for change stream to process
		await new Promise(resolve => setTimeout(resolve, 100));

		expect(notifications.length).toBe(1);
		expect(notifications[0].priority).toBe(10);
	});

	it('should skip jobs without nextRunAt', async () => {
		await channel.connect();

		const notifications: any[] = [];
		channel.subscribe(async notification => {
			notifications.push(notification);
		});

		// Insert a job without nextRunAt
		await db.collection(collectionName).insertOne({
			name: 'no-next-run',
			priority: 0,
			type: 'normal',
			data: {}
		});

		// Wait for change stream to process
		await new Promise(resolve => setTimeout(resolve, 100));

		expect(notifications.length).toBe(0);
	});

	it('should skip disabled jobs', async () => {
		await channel.connect();

		const notifications: any[] = [];
		channel.subscribe(async notification => {
			notifications.push(notification);
		});

		// Insert a disabled job
		await db.collection(collectionName).insertOne({
			name: 'disabled-job',
			nextRunAt: new Date(),
			priority: 0,
			type: 'normal',
			disabled: true,
			data: {}
		});

		// Wait for change stream to process
		await new Promise(resolve => setTimeout(resolve, 100));

		expect(notifications.length).toBe(0);
	});

	it('should disconnect cleanly', async () => {
		await channel.connect();
		expect(channel.state).toBe('connected');

		await channel.disconnect();
		expect(channel.state).toBe('disconnected');
	});

	it('should handle reconnection after error', async () => {
		await channel.connect();

		// Force an error by closing the stream
		(channel as any).changeStream?.close();

		// Wait for reconnection logic
		await new Promise(resolve => setTimeout(resolve, 2000));

		// Should have reconnected
		expect(channel.state).toBe('connected');
	});
});
