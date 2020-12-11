import { Job } from './index';

/**
 * Remove the job from MongoDB
 * @name Job#remove
 * @function
 */
export const remove = function(this: Job) {
  return this.agenda.cancel({_id: this.attrs._id});
};
