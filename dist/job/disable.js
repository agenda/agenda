"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.disable = void 0;
/**
 * Prevents the job type from running
 * @name Job#disable
 * @function
 */
const disable = function () {
    this.attrs.disabled = true;
    return this;
};
exports.disable = disable;
//# sourceMappingURL=disable.js.map