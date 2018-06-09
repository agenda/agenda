'use strict';
const debug = require('debug')('agenda:db_init');

/**
 * Setup and initialize the collection used to manage Jobs.
 * @name Agenda#dbInit
 * @function
 * @param {String} collection name or undefined for default 'agendaJobs'
 * @param {Function} cb called when the db is initialized
 * @returns {undefined}
 */
module.exports = function(collection, cb) {
  const self = this;
  debug('init database collection using name [%s]', collection);
  this._collection = this._mdb.collection(collection || 'agendaJobs');
  debug('attempting index creation');
  this._collection.createIndex(
    this._indices,
    {name: 'findAndLockNextJobIndex'},
    err => {
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
    }
  );
};
