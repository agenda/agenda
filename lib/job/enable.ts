import { Job } from ".";


/**
 * Allows job type to run
 * @name Job#enable
 * @function
 */
export function enable(this: Job): Job {
    this.attrs.disabled = false;
    return this;
}
