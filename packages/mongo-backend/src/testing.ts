/**
 * Test utilities for @agendajs/mongo-backend
 *
 * @example
 * ```typescript
 * import { mockMongo } from '@agendajs/mongo-backend/testing';
 *
 * const { db, disconnect } = await mockMongo();
 * // Use db for testing
 * await disconnect();
 * ```
 */

import { Db, MongoClient } from 'mongodb';
import debug from 'debug';
import { randomUUID } from 'crypto';

const log = debug('agenda:mock-mongodb');

export interface IMockMongo {
	disconnect: () => Promise<void>;
	mongo: MongoClient;
	uri: string;
	db: Db;
}

/**
 * Create a mock MongoDB connection for testing.
 * Requires MONGO_URI environment variable to be set (usually by mongodb-memory-server).
 */
export async function mockMongo(): Promise<IMockMongo> {
	const baseUri = process.env.MONGO_URI;
	if (!baseUri) {
		throw new Error('MONGO_URI not set. Ensure global setup is configured.');
	}

	// Use unique database per test suite to avoid interference
	const dbName = `agenda_test_${randomUUID().replace(/-/g, '')}`;
	// Build URI with database name (ensure single slash before db name)
	const uri = `${baseUri.replace(/\/$/, '')}/${dbName}`;
	log('connecting to mongod with db', dbName);
	const mongo = await MongoClient.connect(uri);
	const db = mongo.db(dbName);

	return {
		uri,
		db,
		mongo,
		disconnect: async () => {
			// Drop the test database to clean up
			await db.dropDatabase();
			await mongo.close();
			log('mongo client closed, db dropped:', dbName);
		}
	};
}

// Re-export types that test files might need
export type { Db, MongoClient } from 'mongodb';
