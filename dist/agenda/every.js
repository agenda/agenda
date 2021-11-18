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
exports.every = void 0;
const debug_1 = __importDefault(require("debug"));
const debug = debug_1.default("agenda:every");
/**
 * Creates a scheduled job with given interval and name/names of the job to run
 * @name Agenda#every
 * @function
 * @param interval - run every X interval
 * @param names - String or strings of jobs to schedule
 * @param data - data to run for job
 * @param options - options to run job for
 * @returns Job/s created. Resolves when schedule fails or passes
 */
const every = function (interval, names, data, options) {
    return __awaiter(this, void 0, void 0, function* () {
        /**
         * Internal method to setup job that gets run every interval
         * @param interval run every X interval
         * @param name String job to schedule
         * @param [data] data to run for job
         * @param [options] options to run job for
         * @returns instance of job
         */
        const createJob = (interval, name, data, options) => __awaiter(this, void 0, void 0, function* () {
            const job = this.create(name, data);
            job.attrs.type = "single";
            job.repeatEvery(interval, options);
            return job.save();
        });
        /**
         * Internal helper method that uses createJob to create jobs for an array of names
         * @param interval run every X interval
         * @param names Strings of jobs to schedule
         * @param [data] data to run for job
         * @param [options] options to run job for
         * @return array of jobs created
         */
        const createJobs = (interval, names, data, options) => __awaiter(this, void 0, void 0, function* () {
            try {
                const jobs = [];
                names.map((name) => jobs.push(createJob(interval, name, data, options)));
                debug("every() -> all jobs created successfully");
                return Promise.all(jobs);
            }
            catch (error) {
                // @TODO: catch - ignore :O
                debug("every() -> error creating one or more of the jobs", error);
            }
        });
        if (typeof names === "string") {
            debug("Agenda.every(%s, %O, %O)", interval, names, options);
            const jobs = yield createJob(interval, names, data, options);
            return jobs;
        }
        if (Array.isArray(names)) {
            debug("Agenda.every(%s, %s, %O)", interval, names, options);
            const jobs = yield createJobs(interval, names, data, options);
            return jobs;
        }
    });
};
exports.every = every;
//# sourceMappingURL=every.js.map