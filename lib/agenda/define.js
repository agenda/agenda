'use strict';
const debug = require('debug')('agenda:define');

/**
 * Setup definition for job
 * Method is used by consumers of lib to setup their functions
 * @name Agenda#define
 * @function
 * @param {String} name name of job
 * @param {Object} options options for job to run
 * @param {Function} processor function to be called to run actual job
 * @returns {undefined}
 */
module.exports = function(name, options, processor) {
  if (!processor) {
    processor = options;
    options = {};
  }

  this._definitions[name] = {
    fn: processor,
    concurrency: options.concurrency || this._defaultConcurrency,
    lockLimit: options.lockLimit || this._defaultLockLimit,
    priority: options.priority || 0,
    lockLifetime: options.lockLifetime || this._defaultLockLifetime,
    running: 0,
    locked: 0
  };
  debug('job [%s] defined with following options: \n%O', name, this._definitions[name]);
};
