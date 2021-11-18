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
exports.saveJob = void 0;
const debug_1 = __importDefault(require("debug"));
const utils_1 = require("../utils");
const debug = debug_1.default("agenda:saveJob");
/**
 * Given a result for findOneAndUpdate() or insert() above, determine whether to process
 * the job immediately or to let the processJobs() interval pick it up later
 * @param job job instance
 * @param result the data returned from the findOneAndUpdate() call or insertOne() call
 * @access private
 */
const processDbResult = function (job, result) {
    return __awaiter(this, void 0, void 0, function* () {
        debug("processDbResult() called with success, checking whether to process job immediately or not");
        // We have a result from the above calls
        // findOneAndUpdate() returns different results than insertOne() so check for that
        let resultValue = result.insertedId ? result.insertedId : result.value;
        if (resultValue) {
            let _id;
            let nextRunAt;
            if (result.insertedId) {
                _id = result.insertedId;
                // find the doc using _id
                const _job = yield this._collection.findOne({ _id });
                if (_job) {
                    nextRunAt = _job.nextRunAt;
                }
            }
            else {
                // If it is an array, grab the first job
                if (Array.isArray(resultValue)) {
                    resultValue = resultValue[0];
                }
                _id = resultValue._id;
                nextRunAt = resultValue.nextRunAt;
            }
            // Grab ID and nextRunAt from MongoDB and store it as an attribute on Job
            job.attrs._id = _id;
            job.attrs.nextRunAt = nextRunAt;
            // If the current job would have been processed in an older scan, process the job immediately
            if (job.attrs.nextRunAt && job.attrs.nextRunAt < this._nextScanAt) {
                debug("[%s:%s] job would have ran by nextScanAt, processing the job immediately", job.attrs.name, resultValue._id);
                yield utils_1.processJobs.call(this, job);
            }
        }
        // Return the Job instance
        return job;
    });
};
/**
 * Save the properties on a job to MongoDB
 * @name Agenda#saveJob
 * @function
 * @param job job to save into MongoDB
 * @returns resolves when job is saved or errors
 */
const saveJob = function (job) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            debug("attempting to save a job into Agenda instance");
            // Grab information needed to save job but that we don't want to persist in MongoDB
            const id = job.attrs._id;
            const { unique, uniqueOpts } = job.attrs;
            // Store job as JSON and remove props we don't want to store from object
            const props = job.toJSON();
            delete props._id;
            delete props.unique;
            delete props.uniqueOpts;
            // Store name of agenda queue as last modifier in job data
            props.lastModifiedBy = this._name;
            debug("[job %s] set job props: \n%O", id, props);
            // Grab current time and set default query options for MongoDB
            const now = new Date();
            const protect = {};
            let update = { $set: props };
            debug("current time stored as %s", now.toISOString());
            // If the job already had an ID, then update the properties of the job
            // i.e, who last modified it, etc
            if (id) {
                // Update the job and process the resulting data'
                debug("job already has _id, calling findOneAndUpdate() using _id as query");
                const result = yield this._collection.findOneAndUpdate({ _id: id }, update, { returnDocument: "after" });
                return yield processDbResult.call(this, job, result);
            }
            if (props.type === "single") {
                // Job type set to 'single' so...
                // NOTE: Again, not sure about difference between 'single' here and 'once' in job.js
                debug('job with type of "single" found');
                // If the nextRunAt time is older than the current time, "protect" that property, meaning, don't change
                // a scheduled job's next run time!
                if (props.nextRunAt && props.nextRunAt <= now) {
                    debug("job has a scheduled nextRunAt time, protecting that field from upsert");
                    // @ts-expect-error
                    protect.nextRunAt = props.nextRunAt;
                    delete props.nextRunAt;
                }
                // If we have things to protect, set them in MongoDB using $setOnInsert
                if (Object.keys(protect).length > 0) {
                    // @ts-expect-error
                    update.$setOnInsert = protect;
                }
                // Try an upsert
                // NOTE: 'single' again, not exactly sure what it means
                debug('calling findOneAndUpdate() with job name and type of "single" as query');
                const result = yield this._collection.findOneAndUpdate({
                    name: props.name,
                    type: "single",
                }, update, {
                    upsert: true,
                    returnDocument: "after",
                });
                return yield processDbResult.call(this, job, result);
            }
            if (unique) {
                // If we want the job to be unique, then we can upsert based on the 'unique' query object that was passed in
                const query = job.attrs.unique;
                query.name = props.name;
                if (uniqueOpts === null || uniqueOpts === void 0 ? void 0 : uniqueOpts.insertOnly) {
                    // @ts-expect-error
                    update = { $setOnInsert: props };
                }
                // Use the 'unique' query object to find an existing job or create a new one
                debug("calling findOneAndUpdate() with unique object as query: \n%O", query);
                const result = yield this._collection.findOneAndUpdate(query, update, {
                    upsert: true,
                    returnDocument: "after",
                });
                return yield processDbResult.call(this, job, result);
            }
            // If all else fails, the job does not exist yet so we just insert it into MongoDB
            debug("using default behavior, inserting new job via insertOne() with props that were set: \n%O", props);
            const result = yield this._collection.insertOne(props);
            return yield processDbResult.call(this, job, result);
        }
        catch (error) {
            debug("processDbResult() received an error, job was not updated/created");
            throw error;
        }
    });
};
exports.saveJob = saveJob;
//# sourceMappingURL=save-job.js.map