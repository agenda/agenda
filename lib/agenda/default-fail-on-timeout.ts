import { Agenda } from ".";
import createDebugger from "debug";

const debug = createDebugger("agenda:defaultFailOnTimeout");

/**
 * Determine if the job should fail when it timeouts.
 * Default is false
 * @name Agenda#defaultFailOnTimeout
 * @function
 * @param {Boolean} failOnTimeout Whether or not job will fail when timeout
 */
export const defaultFailOnTimeout = function (
  this: Agenda,
  failOnTimeout: boolean
): Agenda {
  debug("Agenda.defaultFailOnTimeout(%s)", failOnTimeout);
  this._defaultFailOnTimeout = failOnTimeout;
  return this;
};
