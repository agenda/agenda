import { Agenda } from ".";
import createDebugger from "debug";
import { FilterQuery } from "mongodb";

const debug = createDebugger("agenda:cancel");

/**
 * Cancels any jobs matching the passed MongoDB query, and removes them from the database.
 * @name Agenda#cancel
 * @function
 * @param FilterQuery<any> query MongoDB query to use when cancelling
 * @caller client code, Agenda.purge(), Job.remove()
 */
export const cancel = async function (this: Agenda, query: FilterQuery<any>) {
  debug("attempting to cancel all Agenda jobs", query);
  try {
    const { result } = await this._collection.deleteMany(query);
    debug("%s jobs cancelled", result.n);
    return result.n;
  } catch (error) {
    debug("error trying to delete jobs from MongoDB");
    throw error;
  }
};
