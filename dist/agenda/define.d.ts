import { Agenda } from ".";
import { Job } from "../job";
export declare enum JobPriority {
    highest = 20,
    high = 10,
    normal = 0,
    low = -10,
    lowest = -20
}
export interface DefineOptions {
    /**
     * Maximum number of that job that can be running at once (per instance of agenda)
     */
    concurrency?: number;
    /**
     * Maximum number of that job that can be locked at once (per instance of agenda)
     */
    lockLimit?: number;
    /**
     * Interval in ms of how long the job stays locked for (see multiple job processors for more info). A job will
     * automatically unlock if done() is called.
     */
    lockLifetime?: number;
    /**
     * (lowest|low|normal|high|highest|number) specifies the priority of the job. Higher priority jobs will run
     * first.
     */
    priority?: JobPriority;
    /**
     * Should the return value of the job be persisted
     */
    shouldSaveResult?: boolean;
}
export declare type Processor = ((job: Job) => Promise<void>) | ((job: Job, done: () => void) => void);
/**
 * Setup definition for job
 * Method is used by consumers of lib to setup their functions
 * @name Agenda#define
 * @function
 * @param name name of job
 * @param options options for job to run
 * @param [processor] function to be called to run actual job
 */
export declare const define: (this: Agenda, name: string, options: DefineOptions | Processor, processor?: Processor | undefined) => void;
//# sourceMappingURL=define.d.ts.map