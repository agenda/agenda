'use strict';
const debug = require('debug')('agenda:start');
const utils = require('../utils');

const processJobs = utils.processJobs;

/**
 * Starts processing jobs using processJobs() methods, storing an interval ID
 * @returns {undefined}
 */
module.exports = function() {
  if (this._processInterval) {
    debug('Agenda.start was already called, ignoring');
  } else {
    debug('Agenda.start called, creating interval to call processJobs every [%dms]', this._processEvery);
    this._processInterval = setInterval(processJobs.bind(this), this._processEvery);
    process.nextTick(processJobs.bind(this));
  }
};
