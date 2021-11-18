"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.repeatEvery = void 0;
/**
 * Sets a job to repeat every X amount of time
 * @name Job#repeatEvery
 * @function
 * @param interval repeat every X
 * @param options options to use for job
 */
const repeatEvery = function (interval, options = {}) {
    var _a, _b, _c;
    this.attrs.repeatInterval = interval;
    this.attrs.repeatTimezone = options.timezone ? options.timezone : null;
    // Following options are added to handle start day
    // and cases like run job every x days (skip some days)
    this.attrs.startDate = (_a = options.startDate) !== null && _a !== void 0 ? _a : null;
    this.attrs.endDate = (_b = options.endDate) !== null && _b !== void 0 ? _b : null;
    this.attrs.skipDays = (_c = options.skipDays) !== null && _c !== void 0 ? _c : null;
    if (options.skipImmediate) {
        // Set the lastRunAt time to the nextRunAt so that the new nextRunAt will be computed in reference to the current value.
        this.attrs.lastRunAt = this.attrs.nextRunAt || new Date();
        this.computeNextRunAt();
        this.attrs.lastRunAt = undefined;
    }
    else {
        this.computeNextRunAt();
    }
    return this;
};
exports.repeatEvery = repeatEvery;
//# sourceMappingURL=repeat-every.js.map