import { Job, JobAttributes } from './index';

/**
 * Given a job, turn it into an object we can store in Mongo
 * @name Job#toJSON
 * @function
 * @returns json object from Job
 */
export const toJson = function(this: Job): Partial<JobAttributes> {
  const self = this;
  const attrs = self.attrs || {};
  const result = {};

  for (const prop in attrs) {
    if ({}.hasOwnProperty.call(attrs, prop)) {
      // @ts-expect-error
      result[prop] = attrs[prop];
    }
  }

  const dates = ['lastRunAt', 'lastFinishedAt', 'nextRunAt', 'failedAt', 'lockedAt'];
  dates.forEach(d => {
    // @ts-expect-error
    if (result[d]) {
      // @ts-expect-error
      result[d] = new Date(result[d]);
    }
  });

  return result;
};
