import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod: MongoMemoryServer | undefined;

export async function setup() {
	mongod = await MongoMemoryServer.create();
	const uri = mongod.getUri();
	process.env.MONGO_URI = uri;
	console.log(`\nMongoMemoryServer started: ${uri}`);
}

export async function teardown() {
	if (mongod) {
		await mongod.stop();
		console.log('MongoMemoryServer stopped');
	}
}
