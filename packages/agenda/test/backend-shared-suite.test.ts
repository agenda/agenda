/**
 * Tests for MongoDB backend using the shared test suite
 *
 * This file demonstrates how to use the shared test suites and verifies
 * that the MongoDB backend correctly implements all interfaces.
 */

import { beforeAll, afterAll } from 'vitest';
import { Db } from 'mongodb';
import { MongoJobRepository } from '@agenda.js/mongo-backend';
import { InMemoryNotificationChannel } from '../src';
import { mockMongo } from './helpers/mock-mongodb';
import { repositoryTestSuite, notificationChannelTestSuite } from './shared';

let mongoDb: Db;
let disconnect: () => Promise<void>;

beforeAll(async () => {
	const mock = await mockMongo();
	mongoDb = mock.db;
	disconnect = mock.disconnect;
});

afterAll(async () => {
	await disconnect();
});

// ============================================================================
// MongoDB Repository Tests using Shared Suite
// ============================================================================

repositoryTestSuite({
	name: 'MongoJobRepository (MongoDB)',
	createRepository: async () => {
		const repo = new MongoJobRepository({
			mongo: mongoDb,
			db: { address: '', collection: 'agendaJobs' }
		});
		await repo.connect();
		return repo;
	},
	cleanupRepository: async () => {
		// Don't disconnect - we're sharing the connection
	},
	clearJobs: async () => {
		await mongoDb.collection('agendaJobs').deleteMany({});
	}
});

// ============================================================================
// InMemoryNotificationChannel Tests using Shared Suite
// ============================================================================

notificationChannelTestSuite({
	name: 'InMemoryNotificationChannel',
	createChannel: async () => {
		return new InMemoryNotificationChannel();
	},
	cleanupChannel: async channel => {
		if (channel.state !== 'disconnected') {
			await channel.disconnect();
		}
	},
	propagationDelay: 50 // In-memory is fast
});
