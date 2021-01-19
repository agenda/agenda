import { Agenda } from '.';
import createDebugger from 'debug';

const debug = createDebugger('agenda:define');

export enum JobPriority {
  highest = 20,
  high = 10,
  normal = 0,
  low = -10,
  lowest = -20
}

export interface DefineOptions {
  concurrency?: number;
  lockLimit?: number;
  lockLifetime?: number;
  priority?: JobPriority;
}

/**
 * Setup definition for job
 * Method is used by consumers of lib to setup their functions
 * @name Agenda#define
 * @function
 * @param name name of job
 * @param options options for job to run
 * @param processor function to be called to run actual job
 */
export const define = function(this: Agenda, name: string, options: DefineOptions | (() => void), processor?: () => void) {
  if (processor === undefined) {
    processor = options as (() => void);
    options = {};
  }

  this._definitions[name] = {
    fn: processor,
    concurrency: (options as DefineOptions).concurrency ?? this._defaultConcurrency,
    lockLimit: (options as DefineOptions).lockLimit ?? this._defaultLockLimit,
    priority: (options as DefineOptions).priority ?? JobPriority.normal,
    lockLifetime: (options as DefineOptions).lockLifetime ?? this._defaultLockLifetime,
    running: 0,
    locked: 0
  };
  debug('job [%s] defined with following options: \n%O', name, this._definitions[name]);
};
