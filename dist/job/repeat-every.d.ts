import { Job } from ".";
export interface JobOptions {
    timezone?: string;
    startDate?: Date | number;
    endDate?: Date | number;
    skipDays?: string;
    skipImmediate?: boolean;
}
/**
 * Sets a job to repeat every X amount of time
 * @name Job#repeatEvery
 * @function
 * @param interval repeat every X
 * @param options options to use for job
 */
export declare const repeatEvery: (this: Job, interval: string, options?: JobOptions) => Job;
//# sourceMappingURL=repeat-every.d.ts.map