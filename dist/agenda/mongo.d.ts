import { AnyError, Collection, Db } from "mongodb";
import { Agenda } from ".";
/**
 * Build method used to add MongoDB connection details
 * @name Agenda#mongo
 * @function
 * @param mdb instance of MongoClient to use
 * @param [collection] name collection we want to use ('agendaJobs')
 * @param [cb] called when MongoDB connection fails or passes
 */
export declare const mongo: (this: Agenda, mdb: Db, collection?: string | undefined, cb?: ((error: AnyError | undefined, collection: Collection<any> | null) => void) | undefined) => Agenda;
//# sourceMappingURL=mongo.d.ts.map