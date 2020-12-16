import createDebugger from 'debug';
import { Agenda } from './index';

const debug = createDebugger('agenda:maxConcurrency');

/**
 * Set the concurrency for jobs (globally), type does not matter
 * @name Agenda#maxConcurrency
 * @function
 * @param concurrency max concurrency value
 * @returns agenda instance
 */
export const maxConcurrency = function(this: Agenda, concurrency: number) {
  debug('Agenda.maxConcurrency(%d)', concurrency);
  this._maxConcurrency = concurrency;
  return this;
};
