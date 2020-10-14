import createDebugger from 'debug';
import { Agenda } from './index';

const debug = createDebugger('agenda:db_init');

/**
 * Setup and initialize the collection used to manage Jobs.
 * @name Agenda#dbInit
 * @function
 * @param collection name or undefined for default 'agendaJobs'
 * @param cb called when the db is initialized
 */
export const dbInit = function(this: Agenda, collection: string, cb?: Function) {
  const self = this;
  debug('init database collection using name [%s]', collection);
  this._collection = this._mdb.collection(collection || 'agendaJobs');
  debug('attempting index creation');
  this._collection.createIndex(
    this._indices,
    {name: 'findAndLockNextJobIndex'},
    (error: Error) => {
      if (error) {
        debug('index creation failed');
        self.emit('error', error);
      } else {
        debug('index creation success');
        self.emit('ready');
      }

      if (cb) {
        cb(error, self._collection);
      }
    }
  );
};
