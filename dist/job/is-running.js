"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRunning = void 0;
/**
 * A job is running if:
 * (lastRunAt exists AND lastFinishedAt does not exist)
 * OR
 * (lastRunAt exists AND lastFinishedAt exists but the lastRunAt is newer [in time] than lastFinishedAt)
 * @name Job#isRunning
 * @function
 * @returns Whether or not job is running at the moment (true for running)
 */
const isRunning = function () {
    if (!this.attrs.lastRunAt) {
        return false;
    }
    if (!this.attrs.lastFinishedAt) {
        return true;
    }
    if (this.attrs.lockedAt &&
        this.attrs.lastRunAt.getTime() > this.attrs.lastFinishedAt.getTime()) {
        return true;
    }
    return false;
};
exports.isRunning = isRunning;
//# sourceMappingURL=is-running.js.map