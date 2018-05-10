'use strict';
const debug = require('debug')('agenda:db_init');

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
  if (!this._collection) {
    debug('error on accessing to "' + collection + '" collection in database');
    return cb(new Error('No "' + collection + '" collection existing in database'));
  }
  debug('attempting index creation');
  this._collection.createIndex(this._indices, {
    name: 'findAndLockNextJobIndex'
  }, (err, result) => {
    if (err) {
      debug('index creation failed');
      self.emit('error', err);
    } else {
      debug('index creation success');
      self.emit('ready');
    }

    if (cb) {
      cb(err, self._collection);
    }
  });
};
