import { Job, JobAttributes } from '.';


/**
 * Given a job, turn it into an object we can store in Mongo
 * @name Job#toJSON
 * @function
 * @returns json object from Job
 */
export function toJson(this: Job): Partial<JobAttributes> {
    const attrs = this.attrs || {};
    const result = {};

    for (const prop in attrs) {
        if ({}.hasOwnProperty.call(attrs, prop)) {
            result[prop] = attrs[prop];
        }
    }

    const dates = [
        'lastRunAt',
        'lastFinishedAt',
        'nextRunAt',
        'failedAt',
        'lockedAt'
    ];
    dates.forEach((d) => {
        if (result[d]) {
            result[d] = new Date(result[d]);
        }
    });

    return result;
}
