/**
 * Internal method ensure functions don't have a callback
 * @name noCallback
 * @global
 * @private
 * @param {Object} args Arguments passed to the function
 * @param {Number} length The amount of arguments that should exist
 * @throws {Error} Throws if callback passed
 */
module.exports = (args, length = 0) => {
  if (args.length > length) {
    throw new Error(`This function does not accept a callback function. ${args.length}/${length}`);
  }
};
