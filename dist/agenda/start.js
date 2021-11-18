"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.start = void 0;
const debug_1 = __importDefault(require("debug"));
const utils_1 = require("../utils");
const debug = debug_1.default("agenda:start");
/**
 * Starts processing jobs using processJobs() methods, storing an interval ID
 * This method will only resolve if a db has been set up beforehand.
 * @name Agenda#start
 * @function
 * @returns resolves if db set beforehand, returns undefined otherwise
 */
const start = function () {
    return __awaiter(this, void 0, void 0, function* () {
        if (this._processInterval) {
            debug("Agenda.start was already called, ignoring");
            return this._ready;
        }
        yield this._ready;
        debug("Agenda.start called, creating interval to call processJobs every [%dms]", this._processEvery);
        this._processInterval = setInterval(utils_1.processJobs.bind(this), this._processEvery);
        process.nextTick(utils_1.processJobs.bind(this));
    });
};
exports.start = start;
//# sourceMappingURL=start.js.map