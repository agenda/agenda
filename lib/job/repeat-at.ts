import { Job } from ".";


/**
 * Sets a job to repeat at a specific time
 * @name Job#repeatAt
 * @function
 * @param time time to repeat job at (human readable or number)
 */
export function repeatAt(this: Job, time: string): Job {
    this.attrs.repeatAt = time;
    return this;
}
