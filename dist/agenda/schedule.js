"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.schedule = void 0;
const debug_1 = __importDefault(require("debug"));
const debug = debug_1.default("agenda:schedule");
function schedule(when, names, data) {
    /**
     * Internal method that creates a job with given date
     * @param when when the job gets run
     * @param name of job to run
     * @param data data to send to job
     * @returns instance of new job
     */
    const createJob = (when, name, data) => __awaiter(this, void 0, void 0, function* () {
        const job = this.create(name, data);
        yield job.schedule(when).save();
        return job;
    });
    /**
     * Internal helper method that calls createJob on a names array
     * @param when when the job gets run
     * @param names names of jobs to run
     * @param data data to send to job
     * @returns jobs that were created
     */
    const createJobs = (when, names, data) => __awaiter(this, void 0, void 0, function* () {
        try {
            const createJobList = [];
            names.map((name) => createJobList.push(createJob(when, name, data)));
            debug("Agenda.schedule()::createJobs() -> all jobs created successfully");
            return Promise.all(createJobList);
        }
        catch (error) {
            debug("Agenda.schedule()::createJobs() -> error creating one or more of the jobs");
            throw error;
        }
    });
    if (typeof names === "string") {
        debug("Agenda.schedule(%s, %O, [%O], cb)", when, names);
        return createJob(when, names, data);
    }
    if (Array.isArray(names)) {
        debug("Agenda.schedule(%s, %O, [%O])", when, names);
        return createJobs(when, names, data);
    }
    throw new TypeError("Name must be string or array of strings");
}
exports.schedule = schedule;
;
//# sourceMappingURL=schedule.js.map