"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processEvery = void 0;
const debug_1 = __importDefault(require("debug"));
const human_interval_1 = __importDefault(require("human-interval"));
const debug = debug_1.default("agenda:processEvery");
/**
 * Set the default process interval
 * @name Agenda#processEvery
 * @function
 * @param time - time to process, expressed in human interval
 */
const processEvery = function (time) {
    debug("Agenda.processEvery(%d)", time);
    // @ts-expect-error
    this._processEvery = human_interval_1.default(time);
    return this;
};
exports.processEvery = processEvery;
//# sourceMappingURL=process-every.js.map