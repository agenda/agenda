import createDebugger from "debug";
import { Collection } from "mongodb";
import { Agenda } from ".";

const debug = createDebugger("agenda:db_init");

/**
 * Setup and initialize the collection used to manage Jobs.
 * @name Agenda#dbInit
 * @function
 * @param collection name or undefined for default 'agendaJobs'
 * @param cb called when the db is initialized
 */
export const dbInit = function (
  this: Agenda,
  collection: string | undefined,
  cb?: (error: Error, collection: Collection<any> | null) => void
) {
  debug("init database collection using name [%s]", collection);
  this._collection = this._mdb.collection(collection || "agendaJobs"); // eslint-disable-line @typescript-eslint/prefer-nullish-coalescing
  debug("attempting index creation");
  this._collection.createIndex(
    this._indices,
    { name: "findAndLockNextJobIndex" },
    (error: Error) => {
      if (error) {
        debug("index creation failed");
        this.emit("error", error);
      } else {
        debug("index creation success");
        this.emit("ready");
      }

      if (cb) {
        cb(error, this._collection);
      }
    }
  );
};
