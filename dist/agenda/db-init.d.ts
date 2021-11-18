import { AnyError, Collection } from "mongodb";
import { Agenda } from ".";
/**
 * Setup and initialize the collection used to manage Jobs.
 * @name Agenda#dbInit
 * @function
 * @param collection name or undefined for default 'agendaJobs'
 * @param [cb] called when the db is initialized
 */
export declare const dbInit: (this: Agenda, collection?: string, cb?: ((error: AnyError | undefined, collection: Collection<any> | null) => void) | undefined) => void;
//# sourceMappingURL=db-init.d.ts.map