"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sort = void 0;
const debug_1 = __importDefault(require("debug"));
const debug = debug_1.default("agenda:sort");
/**
 * Set the sort query for finding next job
 * Default is { nextRunAt: 1, priority: -1 }
 * @name Agenda#sort
 * @function
 * @param query sort query object for MongoDB
 */
const sort = function (query) {
    debug("Agenda.sort([Object])");
    this._sort = query;
    return this;
};
exports.sort = sort;
//# sourceMappingURL=sort.js.map