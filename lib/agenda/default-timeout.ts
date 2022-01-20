import { Agenda } from ".";
import createDebugger from "debug";

const debug = createDebugger("agenda:defaultTimeout");

/**
 * Set the default timeout (in ms)
 * Default is 10 * 60 * 1000 ms (10 minutes)
 * @name Agenda#defaultTimeout
 * @function
 * @param {Number} ms time in ms to set default timeout
 */
export const defaultTimeout = function (this: Agenda, ms: number): Agenda {
  debug("Agenda.defaultTimeout(%d)", ms);
  this._defaultTimeout = ms;
  return this;
};
