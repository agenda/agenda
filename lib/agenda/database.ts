import { Collection, MongoClient, MongoClientOptions } from "mongodb";
import createDebugger from "debug";
import { hasMongoProtocol } from "./has-mongo-protocol";
import { Agenda } from ".";

const debug = createDebugger("agenda:database");

/**
 * Connect to the spec'd MongoDB server and database.
 * @name Agenda#database
 * @function
 * @param url MongoDB server URI
 * @param collection name of collection to use. Defaults to `agendaJobs`
 * @param options options for connecting
 * @param cb callback of MongoDB connection
 * NOTE:
 * If `url` includes auth details then `options` must specify: { 'uri_decode_auth': true }. This does Auth on
 * the specified database, not the Admin database. If you are using Auth on the Admin DB and not on the Agenda DB,
 * then you need to authenticate against the Admin DB and then pass the MongoDB instance into the constructor
 * or use Agenda.mongo(). If your app already has a MongoDB connection then use that. ie. specify config.mongo in
 * the constructor or use Agenda.mongo().
 */
export const database = function (
  this: Agenda,
  url: string,
  collection: string,
  options: MongoClientOptions,
  cb?: (error: Error, collection: Collection<any> | null) => void
) {
  if (!hasMongoProtocol(url)) {
    url = "mongodb://" + url;
  }

  const reconnectOptions =
    options?.useUnifiedTopology === true
      ? {}
      : {
          autoReconnect: true,
          reconnectTries: Number.MAX_SAFE_INTEGER,
          reconnectInterval: this._processEvery,
        };

  collection = collection || "agendaJobs";
  options = { ...reconnectOptions, ...options };
  MongoClient.connect(url, options, (error, client) => {
    if (error) {
      debug("error connecting to MongoDB using collection: [%s]", collection);
      if (cb) {
        cb(error, null);
      } else {
        throw error;
      }

      return;
    }

    debug(
      "successful connection to MongoDB using collection: [%s]",
      collection
    );
    this._db = client;
    this._mdb = client.db();
    this.db_init(collection, cb);
  });
  return this;
};
