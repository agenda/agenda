'use strict';
const debug = require('debug')('agenda:db_init');

/**
 * Internal method called in the case where new indices have an error during creation
 * @param {Error} err error returned from index creation from before
 * @param {*} result result passed in from earlier attempt of creating index
 * @param {Agenda} self instance of Agenda
 * @param {Function} cb called when indices fail or pass
 * @returns {undefined}
 */
const handleLegacyCreateIndex = (err, result, self, cb) => {
  if (err && err.message !== 'no such cmd: createIndex') {
    debug('not attempting legacy index, emitting error');
    self.emit('error', err);
  } else {
    // Looks like a mongo.version < 2.4.x
    err = null;
    self._collection.ensureIndex(self._indices, {
      name: 'findAndLockNextJobIndex'
    });
    self.emit('ready');
  }
  if (cb) {
    cb(err, self._collection);
  }
};

/**
 * Setup and initialize the collection used to manage Jobs.
 * @param {String} collection name or undefined for default 'agendaJobs'
 * @param {Function} cb called when the db is initialized
 * @returns {undefined}
 */
module.exports = function(collection, cb) {
  const self = this;
  debug('init database collection using name [%s]', collection);
  this._collection = this._mdb.collection(collection || 'agendaJobs');
  debug('attempting index creation');
  this._collection.createIndex(this._indices, {
    name: 'findAndLockNextJobIndex'
  }, (err, result) => {
    if (err) {
      debug('index creation failed, attempting legacy index creation next');
    } else {
      debug('index creation success');
    }
    handleLegacyCreateIndex(err, result, self, cb);
  });
};
