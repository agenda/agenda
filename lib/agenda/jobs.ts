import { Agenda } from './index';
import { createJob } from '../utils';

/**
 * Finds all jobs matching 'query'
 * @name Agenda#jobs
 * @function
 * @param query object for MongoDB
 * @param sort object for MongoDB
 * @param limit number of documents to return from MongoDB
 * @param number of documents to skip in MongoDB
 * @returns resolves when fails or passes
 */
export const jobs = async function(this: Agenda, query = {}, sort = {}, limit = 0, skip = 0) {
  const result = await this._collection
    .find(query)
    .sort(sort)
    .limit(limit)
    .skip(skip)
    .toArray();

  return result.map((job: any) => createJob(this, job));
};
