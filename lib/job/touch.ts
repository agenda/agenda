import { ClientSession } from "mongodb";
import { Job } from ".";

/**
 * Updates "lockedAt" time so the job does not get picked up again
 * @name Job#touch
 * @function
 */
export const touch = async function (
  this: Job,
  session?: ClientSession
): Promise<Job> {
  this.attrs.lockedAt = new Date();
  return this.save(session);
};
