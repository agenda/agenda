"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.name = void 0;
const debug_1 = __importDefault(require("debug"));
const debug = debug_1.default("agenda:name");
/**
 * Set name of queue
 * @name Agenda#name
 * @function
 * @param name name of agenda instance
 */
const name = function (name) {
    debug("Agenda.name(%s)", name);
    this._name = name;
    return this;
};
exports.name = name;
//# sourceMappingURL=name.js.map