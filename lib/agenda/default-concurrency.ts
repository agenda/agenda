import { Agenda } from ".";
import createDebugger from "debug";

const debug = createDebugger("agenda:defaultConcurrency");

/**
 * Set the default concurrency for each job
 * @name Agenda#defaultConcurrency
 * @function
 * @param concurrency default concurrency
 */
export const defaultConcurrency = function (
  this: Agenda,
  concurrency: number
): Agenda {
  debug("Agenda.defaultConcurrency(%d)", concurrency);
  this._defaultConcurrency = concurrency;
  return this;
};
