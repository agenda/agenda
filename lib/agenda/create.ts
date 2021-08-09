import createDebugger from "debug";
import { Agenda } from ".";
import { Job } from "../job";

const debug = createDebugger("agenda:create");

/**
 * Given a name and some data, create a new job
 * @name Agenda#create
 * @function
 * @param name name of job
 * @param data data to set for job
 */
export const create = function (this: Agenda, name: string, data: any): Job {
  debug("Agenda.create(%s, [Object])", name);
  const priority = this._definitions[name]
    ? this._definitions[name].priority
    : 0;
  const job = new Job({ name, data, type: "normal", priority, agenda: this });
  return job;
};
