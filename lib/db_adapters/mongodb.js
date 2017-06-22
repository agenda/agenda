/*  Code forked from https://github.com/rschmukler/agenda
 *
 *  Updates by Neville Franks neville.franks@gmail.com www.clibu.com
 *  - Refactored MongoDB code to use the MongoDB Native Driver V2 instead of MongoSkin.
 *  - Renamed _db to _collection because it is a collection, not a db.
 *  - Moved code into Agenda.db_init() and call same for all initialization functions.
 *  - Removed findJobsResultWrapper() and replaced with inline code.
 *  - Removed db code from jobs.js
 *  - Comments.
 *
 *  TODO:
 *  - Refactor remaining deprecated MongoDB Native Driver methods. findAndModify()
 *
 *  Last change: NF 4/06/2015 2:06:12 PM
 */
var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient,
  Db = require('mongodb').Db;

var MongoDBAdapter = module.exports = function(agenda, config, cb) {
  this._agenda = agenda;

  if (config.mongo) {
    console.warn("config.mongo deprecated in favor config.connection");
    this.connection(config.mongo, config.db ? config.db.collection : undefined, cb);
  } else if (config.connection) {
    this.connection(config.connection, config.db ? config.db.collection : undefined, cb);
  } else if (config.db) {
    this.database(config.db.address, config.db.collection, config.db.options, cb);
  }
};

MongoDBAdapter.prototype.hasConnection = function() {
  var s = this._mdb.s || this._mdb.db.s;
  return s.topology.connections().length !== 0;
};

// Configuration Methods

MongoDBAdapter.prototype.connection = function( mdb, collection, cb ){
  this._mdb = mdb;
  this.db_init(collection, cb);   // NF 20/04/2015
  return this;
};

/** Connect to the spec'd MongoDB server and database.
 *  Notes:
 *    - If `url` inludes auth details then `options` must specify: { 'uri_decode_auth': true }. This does Auth on the specified
 *      database, not the Admin database. If you are using Auth on the Admin DB and not on the Agenda DB, then you need to
 *      authenticate against the Admin DB and then pass the MongoDB instance in to the Constructor or use Agenda.mongo().
 *    - If your app already has a MongoDB connection then use that. ie. specify config.mongo in the Constructor or use Agenda.mongo().
 */
MongoDBAdapter.prototype.database = function(url, collection, options, cb) {
  if (!url.match(/^mongodb:\/\/.*/)) {
    url = 'mongodb://' + url;
  }

  collection = collection || 'agendaJobs';
  options = options || {};
  var self = this;

  MongoClient.connect(url, options, function ( error, db ){
    if (error) {
      if (cb) {
        cb(error, null);
      } else {
        throw error;
      }

      return;
    }

    self._mdb = db;
    self.db_init( collection, cb );
  });
  return this;
};

/** Setup and initialize the collection used to manage Jobs.
 *  @param collection collection name or undefined for default 'agendaJobs'
 *  NF 20/04/2015
 */
MongoDBAdapter.prototype.db_init = function( collection, cb ){
  this._collection = this._mdb.collection(collection || 'agendaJobs');
  var self = this;
  this._collection.createIndexes([{
                                  "key": {"name" : 1, "priority" : -1, "lockedAt" : 1, "nextRunAt" : 1, "disabled" : 1},
                                  "name": "findAndLockNextJobIndex1"
                                }, {
                                  "key": {"name" : 1, "lockedAt" : 1, "priority" : -1, "nextRunAt" : 1, "disabled" : 1},
                                  "name": "findAndLockNextJobIndex2"
                                }],
                                function( err, result ){
                                  handleLegacyCreateIndex(err, result, self, cb)
                                });
};

function handleLegacyCreateIndex(err, result, self, cb){
  if(err && err.message !== 'no such cmd: createIndexes'){
    self._agenda.emit('error', err);
  } else {
    // Looks like a mongo.version < 2.4.x
    err = null;
    self._collection.ensureIndex(
        {"name": 1, "priority": -1, "lockedAt": 1, "nextRunAt": 1, "disabled": 1},
        {name: "findAndLockNextJobIndex1"}
    );
    self._collection.ensureIndex(
        {"name": 1, "lockedAt": 1, "priority": -1, "nextRunAt": 1, "disabled": 1},
        {name: "findAndLockNextJobIndex2"}
    );

    self._agenda.emit('ready');
  }
  if (cb){
    cb(err, self._collection);
  }
}

/** Find all Jobs matching `query` and pass same back in cb().
 *  refactored. NF 21/04/2015
 */
MongoDBAdapter.prototype.jobs = function(query, cb){
  this._collection.find( query ).toArray( function( err, result ){
    cb( err, result );
  });
};

MongoDBAdapter.prototype.purge = function(definedNames, cb) {
  this.cancel( {name: {$not: {$in: definedNames}}}, cb );   // NF refactored 21/04/2015
};

/** Cancels any jobs matching the passed mongodb query, and removes them from the database.
 *  @param query mongo db query
 *  @param cb callback( error, numRemoved )
 *
 *  @caller client code, Agenda.purge(), Job.remove()
 */
MongoDBAdapter.prototype.cancel = function(query, cb) {
  this._collection.deleteMany( query, function( error, result ){
    if (cb) {
      cb( error, result && result.result ? result.result.n : undefined );
    }
  });
};

MongoDBAdapter.prototype.saveByID = function(id, props, cb) {
  var update = { $set: props };

  this._collection.findAndModify({_id: id}, {}, update, {new: true}, function(err, result) {
    cleanSaveResult(err, result, cb);
  });
};

MongoDBAdapter.prototype.saveSingle = function(name, type, props, insertOnly, cb) {
  var update = { $set: props };

  if (Object.keys(insertOnly).length > 0) {
    update.$setOnInsert = insertOnly;
  }

  this._collection.findAndModify({name: name, type: type}, {}, update, {upsert: true, new: true}, function(err, result) {
    cleanSaveResult(err, result, cb);
  });
};

MongoDBAdapter.prototype.saveUnique = function(name, query, props, insertOnly, cb) {
  var update = {};

  if (Object.keys(props).length > 0) {
    update.$set = props;
  }

  if (Object.keys(insertOnly).length > 0) {
    update.$setOnInsert = insertOnly;
  }

  query.name = name;

  this._collection.findAndModify(query, {}, update, {upsert: true, new: true}, function(err, result) {
    cleanSaveResult(err, result, cb);
  });
};

MongoDBAdapter.prototype.insert = function(insert, cb) {
  this._collection.insertOne(insert, function(err, result) {
    cleanSaveResult(err, result, cb);
  });
};

function cleanSaveResult(err, result, cb) {
  if (err) {
    cb(err, result);
    return;
  } else if (result) {
    var res = result.ops ? result.ops : result.value;
    if ( res ){
      if (Array.isArray(res)) {
        res = res[0];
      }

      cb(err, {id:res._id, nextRunAt: res.nextRunAt});
      return;
    }
  }

  cb(err, null);
};

// Refactored to Agenda method. NF 22/04/2015
// @caller Agenda.stop() only. Could be moved into stop(). NF
MongoDBAdapter.prototype._unlockJobs = function(jobIds, done) {
  this._collection.updateMany({_id: { $in: jobIds } }, { $set: { lockedAt: null } }, done);    // NF refactored .update() 22/04/2015
};

MongoDBAdapter.prototype._findAndLockNextJob = function(jobName, nextScanAt, lockDeadline, cb) {
  var now = new Date();

  this._collection.findAndModify(
    {
      $or: [
        {name: jobName, lockedAt: null, nextRunAt: {$lte: nextScanAt}, disabled: { $ne: true }},
        {name: jobName, lockedAt: {$exists: false}, nextRunAt: {$lte: nextScanAt}, disabled: { $ne: true }},
        {name: jobName, lockedAt: {$lte: lockDeadline}, disabled: { $ne: true }}
      ]
    },
    {'priority': -1},  // sort
    {$set: {lockedAt: now}},  // Doc
    {'new': true},  // options
    function (err, result) {
      cb(err, !err ? result.value : null);
    }
  );
};

MongoDBAdapter.prototype.lockOnTheFly = function(job, cb) {
  var now = new Date();

  var criteria = {
    _id: job.attrs._id,
    lockedAt: null,
    nextRunAt: job.attrs.nextRunAt,
    disabled: { $ne: true }
  };

  this._collection.findAndModify(criteria, {}, { $set: { lockedAt: now } }, { new: true }, function(err, result) {
    if (!err && result.value) {
      cb(err, result.value);
    } else {
      cb(err, null);
    }
  });
};
