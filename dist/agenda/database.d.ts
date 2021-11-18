import { AnyError, Collection, MongoClientOptions } from "mongodb";
import { Agenda } from ".";
/**
 * Connect to the spec'd MongoDB server and database.
 *
 * NOTE:
 * If `url` includes auth details then `options` must specify: { 'uri_decode_auth': true }. This does Auth on
 * the specified database, not the Admin database. If you are using Auth on the Admin DB and not on the Agenda DB,
 * then you need to authenticate against the Admin DB and then pass the MongoDB instance into the constructor
 * or use Agenda.mongo(). If your app already has a MongoDB connection then use that. ie. specify config.mongo in
 * the constructor or use Agenda.mongo().
 * @name Agenda#database
 * @function
 * @param url MongoDB server URI
 * @param [collection] name of collection to use. Defaults to `agendaJobs`
 * @param [options] options for connecting
 * @param [cb] callback of MongoDB connection
 */
export declare const database: (this: Agenda, url: string, collection?: string | undefined, options?: MongoClientOptions, cb?: ((error: AnyError | undefined, collection: Collection<any> | null) => void) | undefined) => Agenda | void;
//# sourceMappingURL=database.d.ts.map