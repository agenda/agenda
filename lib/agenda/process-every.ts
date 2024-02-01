import createDebugger from "debug";
import humanInterval from "human-interval";
import { Agenda } from ".";

const debug = createDebugger("agenda:processEvery");


/**
 * Set the default process interval
 * @name Agenda#processEvery
 * @function
 * @param time - time to process, expressed in human interval
 */
export function processEvery(this: Agenda, time: string): Agenda {
    debug('Agenda.processEvery(%d)', time);
    this._processEvery = humanInterval(time)!;
    return this;
}
