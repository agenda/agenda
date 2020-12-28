import { Agenda } from '.';
import createDebugger from 'debug';

const debug = createDebugger('agenda:close');

/** Close the db and it's underlying connections
 * Only works if agenda was instantiated without preconfigured mongoDb instance.
 * If the mongoDb instance was supplied during instantiation or via agenda.mongo, this function will do nothing and return agenda anyway.
 * @name Agenda#close
 * @function
 * @param force Force close, emitting no events
 *
 * @caller client code
 *
 * @link https://mongodb.github.io/node-mongodb-native/2.0/api/Db.html#close
 */
export const close = async function(this: Agenda, force: boolean): Promise<Agenda> {
  debug('close db connection for this agenda instance');
  try {
    if (this._db) {
      await this._db.close(force);
    }

    return this;
  } catch (error: unknown) {
    debug('error trying to close db connection to');
    throw error;
  }
};
