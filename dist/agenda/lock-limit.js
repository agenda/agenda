"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.lockLimit = void 0;
const debug_1 = __importDefault(require("debug"));
const debug = debug_1.default("agenda:locklimit");
/**
 * Set the default amount jobs that are allowed to be locked at one time (GLOBAL)
 * @name Agenda#locklimit
 * @function
 * @param limit num Lock limit
 */
const lockLimit = function (limit) {
    // @NOTE: Is this different than max concurrency?
    debug("Agenda.lockLimit(%d)", limit);
    this._lockLimit = limit;
    return this;
};
exports.lockLimit = lockLimit;
//# sourceMappingURL=lock-limit.js.map