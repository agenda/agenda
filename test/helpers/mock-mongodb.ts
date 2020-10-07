import { MongoMemoryServer } from 'mongodb-memory-server';
import * as mongo from 'mongodb';
import * as path from 'path';
import { MongoClient } from 'mongodb';

export interface IMockMongo {
	disconnect: () => void;
	mongo: MongoClient;
	mongod: MongoMemoryServer;
	uri: string;
}

export async function mockMongo(): Promise<IMockMongo> {
	const self: IMockMongo = {} as any;
	self.mongod = new MongoMemoryServer({
		binary: {
			version: '4.2.9',
			// set to package directory, so it can be reused
			downloadDir: path.resolve(__dirname, '../../.cache/mongodb-binaries')
		}
	});
	const uri = await self.mongod.getUri();
	console.log('mongod started');
	console.log('mongdb mock connect', uri);
	self.mongo = await mongo.connect(uri);
	self.disconnect = function () {
		self.mongod.stop();
		console.log('mongod stopped');
		self.mongo.close();
	};
	self.uri = uri;

	return self;
}
