import { MongoClient } from 'mongodb';
import { Agenda } from './index';

/**
 * Build method used to add MongoDB connection details
 * @name Agenda#mongo
 * @function
 * @param mdb instance of MongoClient to use
 * @param collection name collection we want to use ('agendaJobs')
 * @param cb called when MongoDB connection fails or passes
 */
export const mongo = function(this: Agenda, mdb: MongoClient, collection: string, cb?: Function): Agenda {
  // @ts-expect-error
  this._mdb = mdb;
  this.db_init(collection, cb);
  return this;
};
