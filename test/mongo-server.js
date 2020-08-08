
const {MongoMemoryServer} = require('mongodb-memory-server');

let connectionString;

let mongoServer;
// eslint-disable-next-line no-undef
beforeEach(async() => {
  mongoServer = new MongoMemoryServer({});
  connectionString = await mongoServer.getConnectionString();
});

// eslint-disable-next-line no-undef
afterEach(async() => {
  await mongoServer.stop();
});

exports.getConnectionString = () => connectionString;
