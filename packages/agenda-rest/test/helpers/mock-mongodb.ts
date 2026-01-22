import { Db, MongoClient } from 'mongodb';
import { randomUUID } from 'crypto';

export interface IMockMongo {
	disconnect: () => Promise<void>;
	mongo: MongoClient;
	uri: string;
	db: Db;
}

export async function mockMongo(): Promise<IMockMongo> {
	const baseUri = process.env.MONGO_URI;
	if (!baseUri) {
		throw new Error('MONGO_URI not set. Ensure global setup is configured.');
	}

	// Use unique database per test suite to avoid interference
	const dbName = `agenda_rest_test_${randomUUID().replace(/-/g, '')}`;
	// Build URI with database name (ensure single slash before db name)
	const uri = `${baseUri.replace(/\/$/, '')}/${dbName}`;
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
		}
	};
}
