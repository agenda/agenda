"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultLockLifetime = void 0;
const debug_1 = __importDefault(require("debug"));
const debug = debug_1.default("agenda:defaultLockLifetime");
/**
 * Set the default lock time (in ms)
 * Default is 10 * 60 * 1000 ms (10 minutes)
 * @name Agenda#defaultLockLifetime
 * @function
 * @param {Number} ms time in ms to set default lock
 */
const defaultLockLifetime = function (ms) {
    debug("Agenda.defaultLockLifetime(%d)", ms);
    this._defaultLockLifetime = ms;
    return this;
};
exports.defaultLockLifetime = defaultLockLifetime;
//# sourceMappingURL=default-lock-lifetime.js.map