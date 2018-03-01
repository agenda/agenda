'use strict';
const debug = require('debug')('agenda:db_init');

/**
 * Setup and initialize the collection used to manage Jobs.
 * @param {String} collection name or undefined for default 'agendaJobs'
 * @param {Function} cb called when the db is initialized
 * @returns {undefined}
 */
module.exports = function(config, cb) {
  const self = this;

  const collection = (config && config.collection) || 'agendaJobs';

  debug('init database collection using name [%s]', collection);
  this._collection = this._mdb.collection(collection || 'agendaJobs');

  if (config && config.noIndexCheck) {
    self.emit('ready');
    if (cb) {
      return cb(null, self._collection);
    }
  }

  debug('attempting index creation');
  this._collection.createIndex(this._indices, {
    name: 'findAndLockNextJobIndex'
  }, (err, result) => {
    if (err) {
      debug('index creation failed');
      self.emit('error', err);
    } else {
      debug('index creation success', result);
      self.emit('ready');
    }

    if (cb) {
      cb(err, self._collection);
    }
  });
};
