import { ClientSession } from "mongodb";
import { Job } from ".";

/**
 * Saves a job into the MongoDB
 * @name Job#
 * @function
 * @returns instance of Job resolved after job is saved or errors
 */
export const save = async function (
  this: Job,
  session?: ClientSession
): Promise<Job> {
  return this.agenda.saveJob(this, session);
};
