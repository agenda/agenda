import { Job } from './index';

/**
 * Updates "lockedAt" time so the job does not get picked up again
 * @name Job#touch
 * @function
 */
export const touch = async function(this: Job) {
  this.attrs.lockedAt = new Date();
  return this.save();
};
