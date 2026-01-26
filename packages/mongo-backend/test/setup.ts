/**
 * Test setup for MongoDB backend tests
 *
 * This file is automatically loaded by vitest before running tests.
 * It starts a MongoMemoryReplSet instance for testing, which enables
 * Change Streams support (required for MongoChangeStreamNotificationChannel).
 */

import { MongoMemoryReplSet } from 'mongodb-memory-server';

let replSet: MongoMemoryReplSet | undefined;

export async function setup() {
	// Use a replica set to enable Change Streams
	replSet = await MongoMemoryReplSet.create({
		replSet: {
			count: 1, // Single node replica set is sufficient for testing
			storageEngine: 'wiredTiger'
		}
	});

	const uri = replSet.getUri();
	process.env.MONGO_URI = uri;
	console.log(`\nMongoMemoryReplSet started: ${uri}`);
}

export async function teardown() {
	if (replSet) {
		await replSet.stop();
		console.log('MongoMemoryReplSet stopped');
	}
}
