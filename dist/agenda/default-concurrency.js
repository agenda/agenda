"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultConcurrency = void 0;
const debug_1 = __importDefault(require("debug"));
const debug = debug_1.default("agenda:defaultConcurrency");
/**
 * Set the default concurrency for each job
 * @name Agenda#defaultConcurrency
 * @function
 * @param concurrency default concurrency
 */
const defaultConcurrency = function (concurrency) {
    debug("Agenda.defaultConcurrency(%d)", concurrency);
    this._defaultConcurrency = concurrency;
    return this;
};
exports.defaultConcurrency = defaultConcurrency;
//# sourceMappingURL=default-concurrency.js.map