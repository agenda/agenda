import { Agenda } from ".";
import { Job } from "../job";
/**
 * Create a job for this exact moment
 * @name Agenda#now
 * @function
 * @param name name of job to schedule
 * @param data data to pass to job
 */
export declare const now: (this: Agenda, name: string, data: any) => Promise<Job>;
//# sourceMappingURL=now.d.ts.map