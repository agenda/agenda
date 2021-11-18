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
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobs = void 0;
const utils_1 = require("../utils");
/**
 * Finds all jobs matching 'query'
 * @name Agenda#jobs
 * @function
 * @param [query] object for MongoDB
 * @param [sort] object for MongoDB
 * @param [limit] number of documents to return from MongoDB
 * @param [number] of documents to skip in MongoDB
 * @returns resolves when fails or passes
 */
const jobs = function (query = {}, sort = {}, limit = 0, skip = 0) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield this._collection
            .find(query) // eslint-disable-line
            .sort(sort)
            .limit(limit)
            .skip(skip)
            .toArray();
        return result.map((job) => utils_1.createJob(this, job));
    });
};
exports.jobs = jobs;
//# sourceMappingURL=jobs.js.map