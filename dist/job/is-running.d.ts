import { Job } from ".";
/**
 * A job is running if:
 * (lastRunAt exists AND lastFinishedAt does not exist)
 * OR
 * (lastRunAt exists AND lastFinishedAt exists but the lastRunAt is newer [in time] than lastFinishedAt)
 * @name Job#isRunning
 * @function
 * @returns Whether or not job is running at the moment (true for running)
 */
export declare const isRunning: (this: Job) => boolean;
//# sourceMappingURL=is-running.d.ts.map