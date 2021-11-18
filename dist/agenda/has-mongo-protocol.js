"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasMongoProtocol = void 0;
/**
 * Given a mongo connection url will check if it contains the mongo
 * @param url URL to be tested
 * @returns whether or not the url is a valid mongo URL
 */
const hasMongoProtocol = function (url) {
    return /mongodb(?:\+srv)?:\/\/.*/.exec(url) !== null;
};
exports.hasMongoProtocol = hasMongoProtocol;
//# sourceMappingURL=has-mongo-protocol.js.map