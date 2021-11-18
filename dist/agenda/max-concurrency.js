"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.maxConcurrency = void 0;
const debug_1 = __importDefault(require("debug"));
const debug = debug_1.default("agenda:maxConcurrency");
/**
 * Set the concurrency for jobs (globally), type does not matter
 * @name Agenda#maxConcurrency
 * @function
 * @param concurrency max concurrency value
 * @returns agenda instance
 */
const maxConcurrency = function (concurrency) {
    debug("Agenda.maxConcurrency(%d)", concurrency);
    this._maxConcurrency = concurrency;
    return this;
};
exports.maxConcurrency = maxConcurrency;
//# sourceMappingURL=max-concurrency.js.map