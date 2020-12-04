import { Job } from './index';

/**
 * Data to ensure is unique for job to be created
 * @name Job#unique
 * @function
 * @param unique mongo data query for unique
 * @param opts unique options
 */
export const unique = function(this: Job, unique: object, opts: object): Job {
  this.attrs.unique = unique;
  this.attrs.uniqueOpts = opts;
  return this;
};
