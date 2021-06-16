import { Job } from ".";

/**
 * Sets the flag if the return value of the job should be persisted
 * @param saveResult flag if the return value of the job should be persisted
 */
export const setSaveResult = function (this: Job, saveResult: boolean): Job {
  this.attrs.saveResult = saveResult;
  return this;
};
