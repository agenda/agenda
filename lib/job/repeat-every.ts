import { Job } from './index';

/**
 * Sets a job to repeat every X amount of time
 * @name Job#repeatEvery
 * @function
 * @param interval repeat every X
 * @param options options to use for job
 */
export const repeatEvery = function(this: Job, interval: string | number, options: any = {}): Job {
  this.attrs.repeatInterval = interval;
  this.attrs.repeatTimezone = options.timezone ? options.timezone : null;
  if (options.skipImmediate) {
    // Set the lastRunAt time to the nextRunAt so that the new nextRunAt will be computed in reference to the current value.
    this.attrs.lastRunAt = this.attrs.nextRunAt || new Date();
    this.computeNextRunAt();
    this.attrs.lastRunAt = undefined;
  } else {
    this.computeNextRunAt();
  }

  return this;
};
