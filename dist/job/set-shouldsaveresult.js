"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setShouldSaveResult = void 0;
/**
 * Sets the flag if the return value of the job should be persisted
 * @param shouldSaveResult flag if the return value of the job should be persisted
 */
const setShouldSaveResult = function (shouldSaveResult) {
    this.attrs.shouldSaveResult = shouldSaveResult;
    return this;
};
exports.setShouldSaveResult = setShouldSaveResult;
//# sourceMappingURL=set-shouldsaveresult.js.map