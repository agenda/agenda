import { Job } from ".";


/**
 * Saves a job into the MongoDB
 * @name Job#
 * @function
 * @returns instance of Job resolved after job is saved or errors
 */
export async function save(this: Job): Promise<Job> {
    return this.agenda.saveJob(this);
}
