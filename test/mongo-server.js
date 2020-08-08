
const {MongoMemoryServer} = require('mongodb-memory-server');

let connectionString;

let mongoServer;
beforeEach(async () => {
	mongoServer = new MongoMemoryServer({});
	connectionString = await mongoServer.getConnectionString();
});

afterEach(async () => {
	await mongoServer.stop();
});

exports.getConnectionString = () => connectionString;
