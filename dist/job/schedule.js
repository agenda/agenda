"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.schedule = void 0;
// @ts-expect-error
const date_js_1 = __importDefault(require("date.js"));
/**
 * Schedules a job to run at specified time
 * @name Job#schedule
 * @function
 * @param time schedule a job to run "then"
 */
const schedule = function (time) {
    const d = new Date(time);
    this.attrs.nextRunAt = Number.isNaN(d.getTime()) ? date_js_1.default(time) : d;
    return this;
};
exports.schedule = schedule;
//# sourceMappingURL=schedule.js.map