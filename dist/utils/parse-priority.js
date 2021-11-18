"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePriority = void 0;
const define_1 = require("../agenda/define");
/**
 * Internal method to turn priority into a number
 * @param priority string to parse into number
 */
const parsePriority = (priority) => {
    if (typeof priority === "number") {
        return priority;
    }
    switch (priority) {
        case "lowest": {
            return define_1.JobPriority.lowest;
        }
        case "low": {
            return define_1.JobPriority.low;
        }
        case "normal": {
            return define_1.JobPriority.normal;
        }
        case "high": {
            return define_1.JobPriority.high;
        }
        case "highest": {
            return define_1.JobPriority.highest;
        }
        default: {
            return define_1.JobPriority.normal;
        }
    }
};
exports.parsePriority = parsePriority;
//# sourceMappingURL=parse-priority.js.map