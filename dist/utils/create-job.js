"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createJob = void 0;
const job_1 = require("../job");
/**
 * Create Job object from data
 * @param {Object} agenda instance of Agenda
 * @param {Object} jobData job data
 * @returns {Job} returns created job
 */
const createJob = (agenda, jobData) => {
    jobData.agenda = agenda;
    return new job_1.Job(jobData);
};
exports.createJob = createJob;
//# sourceMappingURL=create-job.js.map