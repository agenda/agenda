const debug = require("debug")("agenda:test:connector");

const useHostedMongo = /^(true|ye?s?|1)$/i.test(process.env.USE_MONGODB);

let mongoServer;

if (!useHostedMongo) {
  mongoServer = require("./mongo-server");
}

module.exports = async function (agendaDatabase = "agenda-test") {
  let mongoURI;

  if (useHostedMongo) {
    const mongoHost = process.env.MONGODB_HOST || "localhost";
    const mongoPort = process.env.MONGODB_PORT || "27017";
    const replSet = process.env.MONGODB_REPLICA_SET;

    mongoURI = `mongodb://${mongoHost}:${mongoPort}/${agendaDatabase}`;
    if (replSet) {
      mongoURI = `mongodb://${mongoHost}:${mongoPort}/${agendaDatabase}?replicaSet=${replSet}`;
    }
    debug('Returning Hosted Mongo URI: "%s"', mongoURI);
  } else {
    mongoURI = await mongoServer.getConnectionString();

    debug('Returning Mongo-Memory-Server URI: "%s"', mongoURI);
  }

  return mongoURI;
};
