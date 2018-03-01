'use strict';
const MongoClient = require('mongodb').MongoClient;
const debug = require('debug')('agenda:database');

/**
 * Connect to the spec'd MongoDB server and database.
 * @param {String} url MongoDB server URI
 * @param {Object} config
 * @param {Function} cb callback of MongoDB connection
 * @returns {exports}
 * NOTE:
 * If `url` includes auth details then `options` must specify: { 'uri_decode_auth': true }. This does Auth on
 * the specified database, not the Admin database. If you are using Auth on the Admin DB and not on the Agenda DB,
 * then you need to authenticate against the Admin DB and then pass the MongoDB instance into the constructor
 * or use Agenda.mongo(). If your app already has a MongoDB connection then use that. ie. specify config.mongo in
 * the constructor or use Agenda.mongo().
 */
module.exports = function(url, config, cb) {
  const self = this;
  if (!url.match(/^mongodb:\/\/.*/)) {
    url = 'mongodb://' + url;
  }

  const collection = (config && config.collection) || 'agendaJobs';
  const db = (config && config.db) || 'agenda';

  const options = Object.assign({
    autoReconnect: true,
    reconnectTries: Number.MAX_SAFE_INTEGER,
    reconnectInterval: this._processEvery
  }, config && config.options);
  MongoClient.connect(url, options, (error, client) => {
    if (error) {
      debug('error connecting to MongoDB using db [%s] and collection: [%s]', db, collection);
      if (cb) {
        cb(error, null);
      } else {
        throw error;
      }
      return;
    }
    debug('successful connection to MongoDB using db [%s] and collection: [%s]', db, collection);
    self._db = client;
    self._mdb = client.db(db);
    self.db_init(config, cb);
  });
  return this;
};
