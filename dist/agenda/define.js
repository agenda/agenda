"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.define = exports.JobPriority = void 0;
const debug_1 = __importDefault(require("debug"));
const debug = debug_1.default("agenda:define");
var JobPriority;
(function (JobPriority) {
    JobPriority[JobPriority["highest"] = 20] = "highest";
    JobPriority[JobPriority["high"] = 10] = "high";
    JobPriority[JobPriority["normal"] = 0] = "normal";
    JobPriority[JobPriority["low"] = -10] = "low";
    JobPriority[JobPriority["lowest"] = -20] = "lowest";
})(JobPriority = exports.JobPriority || (exports.JobPriority = {}));
/**
 * Setup definition for job
 * Method is used by consumers of lib to setup their functions
 * @name Agenda#define
 * @function
 * @param name name of job
 * @param options options for job to run
 * @param [processor] function to be called to run actual job
 */
const define = function (name, options, processor) {
    if (processor === undefined) {
        processor = options;
        options = {};
    }
    this._definitions[name] = {
        fn: processor,
        concurrency: options.concurrency || this._defaultConcurrency,
        lockLimit: options.lockLimit || this._defaultLockLimit,
        priority: options.priority || JobPriority.normal,
        lockLifetime: options.lockLifetime || this._defaultLockLifetime,
        running: 0,
        locked: 0,
        shouldSaveResult: options.shouldSaveResult || false
    };
    debug("job [%s] defined with following options: \n%O", name, this._definitions[name]);
};
exports.define = define;
//# sourceMappingURL=define.js.map