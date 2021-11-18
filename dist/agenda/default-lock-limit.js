"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultLockLimit = void 0;
const debug_1 = __importDefault(require("debug"));
const debug = debug_1.default("agenda:defaultLockLimit");
/**
 * Set default lock limit per job type
 * @name Agenda#defaultLockLimit
 * @function
 * @param {Number} num Lock limit per job
 * @returns {Agenda} agenda instance
 */
const defaultLockLimit = function (times) {
    debug("Agenda.defaultLockLimit(%d)", times);
    this._defaultLockLimit = times;
    return this;
};
exports.defaultLockLimit = defaultLockLimit;
//# sourceMappingURL=default-lock-limit.js.map