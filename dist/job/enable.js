"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enable = void 0;
/**
 * Allows job type to run
 * @name Job#enable
 * @function
 */
const enable = function () {
    this.attrs.disabled = false;
    return this;
};
exports.enable = enable;
//# sourceMappingURL=enable.js.map