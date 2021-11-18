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
exports.run = void 0;
const debug_1 = __importDefault(require("debug"));
const debug = debug_1.default("agenda:job");
/**
 * Internal method (RUN)
 * @name Job#run
 * @function
 */
const run = function () {
    return __awaiter(this, void 0, void 0, function* () {
        const { agenda } = this;
        const definition = agenda._definitions[this.attrs.name];
        // @TODO: this lint issue should be looked into: https://eslint.org/docs/rules/no-async-promise-executor
        // eslint-disable-next-line no-async-promise-executor
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            this.attrs.lastRunAt = new Date();
            debug("[%s:%s] setting lastRunAt to: %s", this.attrs.name, this.attrs._id, this.attrs.lastRunAt.toISOString());
            this.computeNextRunAt();
            yield this.save();
            let finished = false;
            const jobCallback = (error, result) => __awaiter(this, void 0, void 0, function* () {
                // We don't want to complete the job multiple times
                if (finished) {
                    return;
                }
                finished = true;
                if (error) {
                    this.fail(error);
                }
                else {
                    this.attrs.lastFinishedAt = new Date();
                    if (this.attrs.shouldSaveResult && result) {
                        this.attrs.result = result;
                    }
                }
                this.attrs.lockedAt = null;
                yield this.save().catch((error) => {
                    debug("[%s:%s] failed to be saved to MongoDB", this.attrs.name, this.attrs._id);
                    reject(error);
                });
                debug("[%s:%s] was saved successfully to MongoDB", this.attrs.name, this.attrs._id);
                if (error) {
                    agenda.emit("fail", error, this);
                    agenda.emit("fail:" + this.attrs.name, error, this);
                    debug("[%s:%s] has failed [%s]", this.attrs.name, this.attrs._id, error.message);
                }
                else {
                    agenda.emit("success", this);
                    agenda.emit("success:" + this.attrs.name, this);
                    debug("[%s:%s] has succeeded", this.attrs.name, this.attrs._id);
                }
                agenda.emit("complete", this);
                agenda.emit("complete:" + this.attrs.name, this);
                debug("[%s:%s] job finished at [%s] and was unlocked", this.attrs.name, this.attrs._id, this.attrs.lastFinishedAt);
                // Curiously, we still resolve successfully if the job processor failed.
                // Agenda is not equipped to handle errors originating in user code, so, we leave them to inspect the side-effects of job.fail()
                resolve(this);
            });
            try {
                agenda.emit("start", this);
                agenda.emit("start:" + this.attrs.name, this);
                debug("[%s:%s] starting job", this.attrs.name, this.attrs._id);
                if (!definition) {
                    debug("[%s:%s] has no definition, can not run", this.attrs.name, this.attrs._id);
                    throw new Error("Undefined job");
                }
                if (definition.fn.length === 2) {
                    debug("[%s:%s] process function being called", this.attrs.name, this.attrs._id);
                    yield definition.fn(this, jobCallback);
                }
                else {
                    debug("[%s:%s] process function being called", this.attrs.name, this.attrs._id);
                    const result = yield definition.fn(this);
                    yield jobCallback(undefined, result);
                }
            }
            catch (error) {
                debug("[%s:%s] unknown error occurred", this.attrs.name, this.attrs._id);
                yield jobCallback(error);
            }
        }));
    });
};
exports.run = run;
//# sourceMappingURL=run.js.map