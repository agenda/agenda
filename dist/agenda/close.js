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
exports.close = void 0;
const debug_1 = __importDefault(require("debug"));
const debug = debug_1.default("agenda:close");
/** Close the db and it's underlying connections
 * Only works if agenda was instantiated without preconfigured mongoDb instance.
 * If the mongoDb instance was supplied during instantiation or via agenda.mongo, this function will do nothing and return agenda anyway.
 * @name Agenda#close
 * @function
 * @param [option] {{ force: boolean }} Force close, emitting no events
 *
 *
 * @caller client code
 *
 * @link https://mongodb.github.io/node-mongodb-native/2.0/api/Db.html#close
 */
const close = function (option) {
    return __awaiter(this, void 0, void 0, function* () {
        debug("close db connection for this agenda instance");
        const closeOptions = Object.assign({ force: false }, option);
        try {
            if (this._db) {
                yield this._db.close(closeOptions.force);
            }
            return this;
        }
        catch (error) {
            debug("error trying to close db connection to");
            throw error;
        }
    });
};
exports.close = close;
//# sourceMappingURL=close.js.map