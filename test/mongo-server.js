
const {MongoMemoryServer} = require('mongodb-memory-server');

let connectionString;

let mongoServer;
// eslint-disable-next-line no-undef
before(async() => {
  mongoServer = new MongoMemoryServer({});
  connectionString = await mongoServer.getConnectionString();
  console.log(connectionString);
});

// eslint-disable-next-line no-undef
after(async() => {
  await mongoServer.stop();
});

exports.getConnectionString = () => connectionString;
