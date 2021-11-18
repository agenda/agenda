"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.create = void 0;
const debug_1 = __importDefault(require("debug"));
const job_1 = require("../job");
const debug = debug_1.default("agenda:create");
/**
 * Given a name and some data, create a new job
 * @name Agenda#create
 * @function
 * @param name name of job
 * @param data data to set for job
 */
const create = function (name, data) {
    debug("Agenda.create(%s, [Object])", name);
    const priority = this._definitions[name]
        ? this._definitions[name].priority
        : 0;
    const shouldSaveResult = this._definitions[name] ? this._definitions[name].shouldSaveResult || false : false;
    const job = new job_1.Job({ name, data, type: "normal", priority, shouldSaveResult, agenda: this });
    return job;
};
exports.create = create;
//# sourceMappingURL=create.js.map