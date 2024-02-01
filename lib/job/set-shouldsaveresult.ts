import { Job } from ".";


/**
 * Sets the flag if the return value of the job should be persisted
 * @param shouldSaveResult flag if the return value of the job should be persisted
 */
export function setShouldSaveResult(this: Job, shouldSaveResult: boolean): Job {
    this.attrs.shouldSaveResult = shouldSaveResult;
    return this;
}
