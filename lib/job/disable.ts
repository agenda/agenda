import { Job } from ".";


/**
 * Prevents the job type from running
 * @name Job#disable
 * @function
 */
export function disable(this: Job): Job {
    this.attrs.disabled = true;
    return this;
}
