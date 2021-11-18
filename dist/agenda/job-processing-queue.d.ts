import { Job } from "../job";
/**
 * @class
 * @param {Object} args - Job Options
 * @property {Object} agenda - The Agenda instance
 * @property {Object} attrs
 */
declare class JobProcessingQueue {
    pop: () => Job | undefined;
    push: (job: Job) => void;
    insert: (job: Job) => void;
    returnNextConcurrencyFreeJob: (agendaDefinitions: any) => Job;
    protected _queue: Job[];
    constructor();
    get length(): number;
}
export { JobProcessingQueue };
//# sourceMappingURL=job-processing-queue.d.ts.map