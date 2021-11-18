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
exports.disable = void 0;
const debug_1 = __importDefault(require("debug"));
const debug = debug_1.default("agenda:disable");
/**
 * Disables any jobs matching the passed MongoDB query by setting the `disabled` flag to `true`
 * @name Agenda#disable
 * @function
 * @param query MongoDB query to use when enabling
 * @returns {Promise<number>} Resolved with the number of disabled job instances.
 */
const disable = function (query = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        debug("attempting to disable all jobs matching query", query);
        try {
            const { modifiedCount } = yield this._collection.updateMany(query, {
                $set: { disabled: true },
            });
            debug("%s jobs disabled");
            return modifiedCount;
        }
        catch (error) {
            debug("error trying to mark jobs as `disabled`");
            throw error;
        }
    });
};
exports.disable = disable;
//# sourceMappingURL=disable.js.map