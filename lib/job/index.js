'use strict';

/**
 * Internal method to turn priority into a number
 * @param {String|Number} priority string to parse into number
 * @returns {Number} priority that was parsed
 */
const parsePriority = priority => {
  const priorityMap = {
    lowest: -20,
    low: -10,
    normal: 0,
    high: 10,
    highest: 20
  };
  if (typeof priority === 'number' || priority instanceof Number) {
    return priority;
  }

  return priorityMap[priority];
};

/**
 * @class
 * @param {Object} args - Job Options
 * @property {Object} agenda - The Agenda instance
 * @property {Object} attrs
 */
class Job {
  constructor(args) {
    args = args || {};

    // Remove special args
    this.agenda = args.agenda;
    delete args.agenda;

    // Process args
    args.priority = parsePriority(args.priority) || 0;

    // Set attrs to args
    const attrs = {};
    for (const key in args) {
      if ({}.hasOwnProperty.call(args, key)) {
        attrs[key] = args[key];
      }
    }

    // Set defaults if undefined
    // NOTE: What is the difference between 'once' here and 'single' in agenda/index.js?
    attrs.nextRunAt = attrs.nextRunAt || new Date();
    attrs.type = attrs.type || 'once';
    this.attrs = attrs;
  }
}

Job.prototype.toJSON = require('./to-json');
Job.prototype.computeNextRunAt = require('./compute-next-run-at');
Job.prototype.repeatEvery = require('./repeat-every');
Job.prototype.repeatAt = require('./repeat-at');
Job.prototype.disable = require('./disable');
Job.prototype.enable = require('./enable');
Job.prototype.unique = require('./unique');
Job.prototype.schedule = require('./schedule');
Job.prototype.priority = require('./priority');
Job.prototype.fail = require('./fail');
Job.prototype.run = require('./run');
Job.prototype.isRunning = require('./is-running');
Job.prototype.save = require('./save');
Job.prototype.remove = require('./remove');
Job.prototype.touch = require('./touch');

module.exports = Job;
