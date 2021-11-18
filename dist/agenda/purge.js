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
exports.purge = void 0;
const debug_1 = __importDefault(require("debug"));
const debug = debug_1.default("agenda:purge");
/**
 * Removes all jobs from queue
 * @name Agenda#purge
 * @function
 * @returns resolved when job cancelling fails or passes
 */
const purge = function () {
    return __awaiter(this, void 0, void 0, function* () {
        // @NOTE: Only use after defining your jobs
        const definedNames = Object.keys(this._definitions);
        debug("Agenda.purge(%o)", definedNames);
        return this.cancel({ name: { $not: { $in: definedNames } } });
    });
};
exports.purge = purge;
//# sourceMappingURL=purge.js.map