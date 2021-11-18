"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbInit = void 0;
const debug_1 = __importDefault(require("debug"));
const debug = debug_1.default("agenda:db_init");
/**
 * Setup and initialize the collection used to manage Jobs.
 * @name Agenda#dbInit
 * @function
 * @param collection name or undefined for default 'agendaJobs'
 * @param [cb] called when the db is initialized
 */
const dbInit = function (collection = "agendaJobs", cb) {
    debug("init database collection using name [%s]", collection);
    this._collection = this._mdb.collection(collection);
    debug("attempting index creation");
    this._collection.createIndex(this._indices, { name: "findAndLockNextJobIndex" }, (error) => {
        if (error) {
            debug("index creation failed");
            this.emit("error", error);
        }
        else {
            debug("index creation success");
            this.emit("ready");
        }
        if (cb) {
            cb(error, this._collection);
        }
    });
};
exports.dbInit = dbInit;
//# sourceMappingURL=db-init.js.map