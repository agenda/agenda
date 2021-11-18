"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toJson = void 0;
/**
 * Given a job, turn it into an object we can store in Mongo
 * @name Job#toJSON
 * @function
 * @returns json object from Job
 */
const toJson = function () {
    const attrs = this.attrs || {};
    const result = {};
    for (const prop in attrs) {
        if ({}.hasOwnProperty.call(attrs, prop)) {
            // @ts-expect-error index signature missing
            result[prop] = attrs[prop];
        }
    }
    const dates = [
        "lastRunAt",
        "lastFinishedAt",
        "nextRunAt",
        "failedAt",
        "lockedAt",
    ];
    dates.forEach((d) => {
        // @ts-expect-error index signature missing
        if (result[d]) {
            // @ts-expect-error index signature missing
            result[d] = new Date(result[d]);
        }
    });
    return result;
};
exports.toJson = toJson;
//# sourceMappingURL=to-json.js.map