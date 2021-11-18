"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mongo = void 0;
/**
 * Build method used to add MongoDB connection details
 * @name Agenda#mongo
 * @function
 * @param mdb instance of MongoClient to use
 * @param [collection] name collection we want to use ('agendaJobs')
 * @param [cb] called when MongoDB connection fails or passes
 */
const mongo = function (mdb, collection, cb) {
    this._mdb = mdb;
    this.db_init(collection, cb);
    return this;
};
exports.mongo = mongo;
//# sourceMappingURL=mongo.js.map