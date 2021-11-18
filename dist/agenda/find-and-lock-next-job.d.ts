import { Agenda } from ".";
import { Job } from "../job";
/**
 * Find and lock jobs
 * @name Agenda#findAndLockNextJob
 * @function
 * @param jobName name of job to try to lock
 * @param definition definition used to tell how job is run
 * @access protected
 * @caller jobQueueFilling() only
 */
export declare const findAndLockNextJob: (this: Agenda, jobName: string, definition: any) => Promise<Job | undefined>;
//# sourceMappingURL=find-and-lock-next-job.d.ts.map