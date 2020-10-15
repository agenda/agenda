'use strict';
const debug = require('debug')('agenda:createIndex');

/**
 * Setup default index for jobs collection.
 * @name Agenda#createIndex
 * @function
 * @returns {Promise}
 */
module.exports = async function() {
  const self = this;
  return new Promise((resolve, reject) => {
    this._collection.createIndex(
      this._indices,
      {name: 'findAndLockNextJobIndex'},
      (err, result) => {
        if (err) {
          debug('index creation failed');
          self.emit('error', err);
          return reject(err);
        }

        debug('index creation success');
        self.emit('index:created', result);
        resolve();
      }
    );
  });
};
