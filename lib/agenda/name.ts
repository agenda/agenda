import createDebugger from 'debug';
import { Agenda } from './index';

const debug = createDebugger('agenda:name');

/**
 * Set name of queue
 * @name Agenda#name
 * @function
 * @param name name of agenda instance
 */
export const name = function(this: Agenda, name: string) {
  debug('Agenda.name(%s)', name);
  this._name = name;
  return this;
};
