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
exports.stop = void 0;
const debug_1 = __importDefault(require("debug"));
const debug = debug_1.default("agenda:stop");
/**
 * Clear the interval that processes the jobs
 * @name Agenda#stop
 * @function
 * @returns resolves when job unlocking fails or passes
 */
const stop = function () {
    return __awaiter(this, void 0, void 0, function* () {
        /**
         * Internal method to unlock jobs so that they can be re-run
         * NOTE: May need to update what properties get set here, since job unlocking seems to fail
         * @access private
         * @returns resolves when job unlocking fails or passes
         */
        const _unlockJobs = () => __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                debug("Agenda._unlockJobs()");
                const jobIds = this._lockedJobs.map((job) => job.attrs._id);
                if (jobIds.length === 0) {
                    debug("no jobs to unlock");
                    resolve();
                }
                debug("about to unlock jobs with ids: %O", jobIds);
                this._collection.updateMany({ _id: { $in: jobIds } }, { $set: { lockedAt: null } }, (error) => {
                    if (error) {
                        reject(error);
                    }
                    this._lockedJobs = [];
                    resolve();
                });
            });
        });
        debug("Agenda.stop called, clearing interval for processJobs()");
        clearInterval(this._processInterval);
        this._processInterval = undefined;
        return _unlockJobs();
    });
};
exports.stop = stop;
//# sourceMappingURL=stop.js.map