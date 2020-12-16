import { Job } from './index';

/**
 * Saves a job into the MongoDB
 * @name Job#
 * @function
 * @returns instance of Job resolved after job is saved or errors
 */
export const save = function(this: Job) {
  return this.agenda.saveJob(this);
};
