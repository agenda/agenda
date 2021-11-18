"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeNextRunAt = void 0;
const parser = __importStar(require("cron-parser"));
const human_interval_1 = __importDefault(require("human-interval"));
const debug_1 = __importDefault(require("debug"));
const moment_timezone_1 = __importDefault(require("moment-timezone"));
// @ts-expect-error
const date_js_1 = __importDefault(require("date.js"));
const debug = debug_1.default("agenda:job");
/**
 * Internal method used to compute next time a job should run and sets the proper values
 * @name Job#computeNextRunAt
 * @function
 */
const computeNextRunAt = function () {
    const interval = this.attrs.repeatInterval;
    const timezone = this.attrs.repeatTimezone;
    const { repeatAt } = this.attrs;
    const previousNextRunAt = this.attrs.nextRunAt || new Date();
    this.attrs.nextRunAt = undefined;
    const dateForTimezone = (date) => {
        const mdate = moment_timezone_1.default(date);
        if (timezone) {
            mdate.tz(timezone);
        }
        return mdate;
    };
    /**
     * Internal method that computes the interval
     */
    const computeFromInterval = () => {
        var _a, _b, _c, _d;
        debug("[%s:%s] computing next run via interval [%s]", this.attrs.name, this.attrs._id, interval);
        const dateNow = new Date();
        let lastRun = this.attrs.lastRunAt || dateNow;
        let { startDate, endDate, skipDays } = this.attrs;
        lastRun = dateForTimezone(lastRun).toDate();
        const cronOptions = { currentDate: lastRun };
        if (timezone) {
            cronOptions.tz = timezone;
        }
        try {
            let cronTime = parser.parseExpression(interval, cronOptions);
            let nextDate = cronTime.next().toDate();
            if (nextDate.getTime() === lastRun.getTime() ||
                nextDate.getTime() <= previousNextRunAt.getTime()) {
                // Handle cronTime giving back the same date for the next run time
                cronOptions.currentDate = new Date(lastRun.getTime() + 1000);
                cronTime = parser.parseExpression(interval, cronOptions);
                nextDate = cronTime.next().toDate();
            }
            // If start date is present, check if the nextDate should be larger or equal to startDate. If not set startDate as nextDate
            if (startDate) {
                startDate = moment_timezone_1.default
                    .tz(moment_timezone_1.default(startDate).format("YYYY-MM-DD"), timezone)
                    .toDate();
                if (startDate > nextDate) {
                    cronOptions.currentDate = startDate;
                    cronTime = parser.parseExpression(interval, cronOptions);
                    nextDate = cronTime.next().toDate();
                }
            }
            // If job has run in the past and skipDays is not null, add skipDays to nextDate
            if (dateNow > lastRun && skipDays !== null) {
                try {
                    nextDate = new Date(nextDate.getTime() + ((_a = human_interval_1.default(skipDays)) !== null && _a !== void 0 ? _a : 0));
                }
                catch (_e) { }
            }
            // If endDate is less than the nextDate, set nextDate to null to stop the job from running further
            if (endDate) {
                const endDateDate = moment_timezone_1.default
                    .tz(moment_timezone_1.default(endDate).format("YYYY-MM-DD"), timezone)
                    .toDate();
                if (nextDate > endDateDate) {
                    nextDate = null;
                }
            }
            this.attrs.nextRunAt = nextDate;
            debug("[%s:%s] nextRunAt set to [%s]", this.attrs.name, this.attrs._id, (_b = this.attrs.nextRunAt) === null || _b === void 0 ? void 0 : _b.toISOString());
            // Either `xo` linter or Node.js 8 stumble on this line if it isn't just ignored
        }
        catch (_f) {
            debug("[%s:%s] failed nextRunAt based on interval [%s]", this.attrs.name, this.attrs._id, interval);
            // Nope, humanInterval then!
            try {
                if (!this.attrs.lastRunAt && human_interval_1.default(interval)) {
                    this.attrs.nextRunAt = lastRun;
                    debug("[%s:%s] nextRunAt set to [%s]", this.attrs.name, this.attrs._id, this.attrs.nextRunAt.toISOString());
                }
                else {
                    this.attrs.nextRunAt = new Date(lastRun.getTime() + ((_c = human_interval_1.default(interval)) !== null && _c !== void 0 ? _c : 0));
                    debug("[%s:%s] nextRunAt set to [%s]", this.attrs.name, this.attrs._id, this.attrs.nextRunAt.toISOString());
                }
                // Either `xo` linter or Node.js 8 stumble on this line if it isn't just ignored
            }
            catch (_g) { }
        }
        finally {
            if (!((_d = this.attrs.nextRunAt) === null || _d === void 0 ? void 0 : _d.getTime())) {
                this.attrs.nextRunAt = undefined;
                debug("[%s:%s] failed to calculate nextRunAt due to invalid repeat interval", this.attrs.name, this.attrs._id);
                this.fail("failed to calculate nextRunAt due to invalid repeat interval");
            }
        }
    };
    /**
     * Internal method to compute next run time from the repeat string
     */
    const computeFromRepeatAt = () => {
        var _a, _b;
        const lastRun = this.attrs.lastRunAt || new Date();
        const nextDate = date_js_1.default(repeatAt);
        // If you do not specify offset date for below test it will fail for ms
        const offset = Date.now();
        if (offset === date_js_1.default(repeatAt, offset).getTime()) {
            this.attrs.nextRunAt = undefined;
            debug("[%s:%s] failed to calculate repeatAt due to invalid format", this.attrs.name, this.attrs._id);
            this.fail("failed to calculate repeatAt time due to invalid format");
        }
        else if (nextDate.getTime() === lastRun.getTime()) {
            this.attrs.nextRunAt = date_js_1.default("tomorrow at ", repeatAt);
            debug("[%s:%s] nextRunAt set to [%s]", this.attrs.name, this.attrs._id, (_a = this.attrs.nextRunAt) === null || _a === void 0 ? void 0 : _a.toISOString());
        }
        else {
            this.attrs.nextRunAt = date_js_1.default(repeatAt);
            debug("[%s:%s] nextRunAt set to [%s]", this.attrs.name, this.attrs._id, (_b = this.attrs.nextRunAt) === null || _b === void 0 ? void 0 : _b.toISOString());
        }
    };
    if (interval) {
        computeFromInterval();
    }
    else if (repeatAt) {
        computeFromRepeatAt();
    }
    return this;
};
exports.computeNextRunAt = computeNextRunAt;
//# sourceMappingURL=compute-next-run-at.js.map