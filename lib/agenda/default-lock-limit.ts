import { Agenda } from './index';
import createDebugger from 'debug';

const debug = createDebugger('agenda:defaultLockLimit');

/**
 * Set default lock limit per job type
 * @name Agenda#defaultLockLimit
 * @function
 * @param {Number} num Lock limit per job
 * @returns {Agenda} agenda instance
 */
export const defaultLockLimit = function(this: Agenda, num: number): Agenda {
  debug('Agenda.defaultLockLimit(%d)', num);
  this._defaultLockLimit = num;
  return this;
};
