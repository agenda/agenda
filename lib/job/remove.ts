import { Job } from ".";


/**
 * Remove the job from MongoDB
 * @name Job#remove
 * @function
 */
export async function remove(this: Job): Promise<number | undefined> {
    return this.agenda.cancel({ _id: this.attrs._id });
}
