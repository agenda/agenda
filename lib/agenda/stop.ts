import createDebugger from 'debug';
import { Agenda } from './index';

const debug = createDebugger('agenda:stop');

/**
 * Clear the interval that processes the jobs
 * @name Agenda#stop
 * @function
 * @returns resolves when job unlocking fails or passes
 */
export const stop = function(this: Agenda): Promise<any> {
  const self = this;
  /**
   * Internal method to unlock jobs so that they can be re-run
   * NOTE: May need to update what properties get set here, since job unlocking seems to fail
   * @access private
   * @returns resolves when job unlocking fails or passes
   */
  const _unlockJobs = function() {
    return new Promise((resolve, reject) => {
      debug('Agenda._unlockJobs()');
      const jobIds = self._lockedJobs.map(job => job.attrs._id);

      if (jobIds.length === 0) {
        debug('no jobs to unlock');
        return resolve();
      }

      debug('about to unlock jobs with ids: %O', jobIds);
      self._collection.updateMany({_id: {$in: jobIds}}, {$set: {lockedAt: null}}, (error: Error) => {
        if (error) {
          return reject(error);
        }

        self._lockedJobs = [];
        return resolve();
      });
    });
  };

  debug('Agenda.stop called, clearing interval for processJobs()');
  clearInterval(this._processInterval);
  this._processInterval = undefined;
  return _unlockJobs();
};
