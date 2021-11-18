"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Job = void 0;
const to_json_1 = require("./to-json");
const compute_next_run_at_1 = require("./compute-next-run-at");
const repeat_every_1 = require("./repeat-every");
const repeat_at_1 = require("./repeat-at");
const disable_1 = require("./disable");
const enable_1 = require("./enable");
const unique_1 = require("./unique");
const schedule_1 = require("./schedule");
const priority_1 = require("./priority");
const fail_1 = require("./fail");
const run_1 = require("./run");
const is_running_1 = require("./is-running");
const save_1 = require("./save");
const remove_1 = require("./remove");
const touch_1 = require("./touch");
const set_shouldsaveresult_1 = require("./set-shouldsaveresult");
const utils_1 = require("../utils");
const define_1 = require("../agenda/define");
/**
 * @class
 * @param {Object} args - Job Options
 * @property {Object} agenda - The Agenda instance
 * @property {Object} attrs
 */
class Job {
    constructor(options) {
        const _a = options !== null && options !== void 0 ? options : {}, { agenda, type, nextRunAt } = _a, args = __rest(_a, ["agenda", "type", "nextRunAt"]);
        // Save Agenda instance
        this.agenda = agenda;
        // Set priority
        args.priority =
            args.priority === undefined
                ? define_1.JobPriority.normal
                : utils_1.parsePriority(args.priority);
        // Set shouldSaveResult option
        args.shouldSaveResult = args.shouldSaveResult || false;
        // Set attrs to args
        const attrs = {};
        for (const key in args) {
            if ({}.hasOwnProperty.call(args, key)) {
                // @ts-expect-error
                attrs[key] = args[key];
            }
        }
        // Set defaults if undefined
        this.attrs = Object.assign(Object.assign({}, attrs), { 
            // NOTE: What is the difference between 'once' here and 'single' in agenda/index.js?
            name: attrs.name || "", priority: attrs.priority, type: type || "once", nextRunAt: nextRunAt || new Date() });
    }
}
exports.Job = Job;
Job.prototype.toJSON = to_json_1.toJson;
Job.prototype.computeNextRunAt = compute_next_run_at_1.computeNextRunAt;
Job.prototype.repeatEvery = repeat_every_1.repeatEvery;
Job.prototype.repeatAt = repeat_at_1.repeatAt;
Job.prototype.disable = disable_1.disable;
Job.prototype.enable = enable_1.enable;
Job.prototype.unique = unique_1.unique;
Job.prototype.schedule = schedule_1.schedule;
Job.prototype.priority = priority_1.priority;
Job.prototype.fail = fail_1.fail;
Job.prototype.run = run_1.run;
Job.prototype.isRunning = is_running_1.isRunning;
Job.prototype.save = save_1.save;
Job.prototype.remove = remove_1.remove;
Job.prototype.touch = touch_1.touch;
Job.prototype.setShouldSaveResult = set_shouldsaveresult_1.setShouldSaveResult;
//# sourceMappingURL=index.js.map