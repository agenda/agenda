module.exports = (args, length = 0) => {
  if (args.length > length) {
    throw new Error(`This function does not accept a callback function. ${args.length}/${length}`);
  }
};
