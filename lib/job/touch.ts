import { Job } from ".";


/**
 * Updates "lockedAt" time so the job does not get picked up again
 * @name Job#touch
 * @function
 */
export async function touch(this: Job): Promise<Job> {
    this.attrs.lockedAt = new Date();
    return this.save();
}
