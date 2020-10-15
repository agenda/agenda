import { MongoMemoryServer } from 'mongodb-memory-server';
import * as mongo from 'mongodb';
import { MongoClient } from 'mongodb';
import * as debug from 'debug';

const log = debug('agenda:mock-mongodb');

export interface IMockMongo {
	disconnect: () => void;
	mongo: MongoClient;
	mongod: MongoMemoryServer;
	uri: string;
}

export async function mockMongo(): Promise<IMockMongo> {
	const self: IMockMongo = {} as any;
	self.mongod = new MongoMemoryServer();
	const uri = await self.mongod.getUri();
	log('mongod started', uri);
	self.mongo = await mongo.connect(uri, { useUnifiedTopology: true });
	self.disconnect = function () {
		self.mongod.stop();
		log('mongod stopped');
		self.mongo.close();
	};
	self.uri = uri;

	return self;
}
