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
exports.now = void 0;
const debug_1 = __importDefault(require("debug"));
const debug = debug_1.default("agenda:now");
/**
 * Create a job for this exact moment
 * @name Agenda#now
 * @function
 * @param name name of job to schedule
 * @param data data to pass to job
 */
const now = function (name, data) {
    return __awaiter(this, void 0, void 0, function* () {
        debug("Agenda.now(%s, [Object])", name);
        try {
            const job = this.create(name, data);
            job.schedule(new Date());
            yield job.save();
            return job;
        }
        catch (error) {
            debug("error trying to create a job for this exact moment");
            throw error;
        }
    });
};
exports.now = now;
//# sourceMappingURL=now.js.map