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
exports.cancel = void 0;
const debug_1 = __importDefault(require("debug"));
const debug = debug_1.default("agenda:cancel");
/**
 * Cancels any jobs matching the passed MongoDB query, and removes them from the database.
 * @name Agenda#cancel
 * @function
 * @param query MongoDB query to use when cancelling
 * @caller client code, Agenda.purge(), Job.remove()
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cancel = function (query) {
    return __awaiter(this, void 0, void 0, function* () {
        debug("attempting to cancel all Agenda jobs", query);
        try {
            const { deletedCount } = yield this._collection.deleteMany(query);
            debug("%s jobs cancelled", deletedCount);
            return deletedCount;
        }
        catch (error) {
            debug("error trying to delete jobs from MongoDB");
            throw error;
        }
    });
};
exports.cancel = cancel;
//# sourceMappingURL=cancel.js.map