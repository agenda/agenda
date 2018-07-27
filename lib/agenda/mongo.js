'use strict';

/**
 * Build method used to add MongoDB connection details
 * @name Agenda#mongo
 * @function
 * @param {MongoClient} mdb instance of MongoClient to use
 * @param {Object} dbConfig
 * @param {Function} cb called when MongoDB connection fails or passes
 * @returns {exports} instance of Agenda
 */
module.exports = function(mdb, dbConfig, cb) {
  this._mdb = mdb;
  this.db_init(dbConfig, cb);
  return this;
};
