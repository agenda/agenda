/**
 * @class
 * @param {Object} args - Job Options
 * @property {Object} agenda - The Agenda instance
 * @property {Object} attrs
 */
class JobProcessingQueue {
  constructor() {
    this._queue = [];
  }

  get length() {
    return this._queue.length;
  }
}

/**
 * Pops and returns last queue element (next job to be processed) without checking concurrency.
 * @returns {Job} Next Job to be processed
 */
JobProcessingQueue.prototype.pop = function() {
  return this._queue.pop();
};

/**
 * Inserts job in first queue position
 * @param {Job} job job to add to queue
 * @returns {undefined}
 */
JobProcessingQueue.prototype.push = function(job) {
  this._queue.push(job);
};

/**
 * Inserts job in queue where it will be order from left to right in decreasing
 * order of nextRunAt and priority (in case of same nextRunAt), if all values
 * are even the first jobs to be introduced will have priority
 * @param {Job} job job to add to queue
 * @returns {undefined}
 */
JobProcessingQueue.prototype.insert = function(job) {
  const matchIndex = this._queue.findIndex(element => {
    if (element.attrs.nextRunAt.getTime() <= job.attrs.nextRunAt.getTime()) {
      if (element.attrs.nextRunAt.getTime() === job.attrs.nextRunAt.getTime()) {
        if (element.attrs.priority >= job.attrs.priority) {
          return true;
        }
      } else {
        return true;
      }
    }

    return false;
  });

  if (matchIndex === -1) {
    this._queue.push(job);
  } else {
    this._queue.splice(matchIndex, 0, job);
  }
};

/**
 * Returns (does not pop, element remains in queue) first element (always from the right)
 * that can be processed (not blocked by concurrency execution)
 * @param {Object} agendaDefinitions job to add to queue
 * @returns {Job} Next Job to be processed
 */
JobProcessingQueue.prototype.returnNextConcurrencyFreeJob = function(agendaDefinitions) {
  let next;
  for (next = this._queue.length - 1; next > 0; next -= 1) {
    const def = agendaDefinitions[this._queue[next].attrs.name];
    if (def.concurrency > def.running) {
      break;
    }
  }

  return this._queue[next];
};

module.exports = JobProcessingQueue;
