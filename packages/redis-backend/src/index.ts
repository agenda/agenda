/**
 * @agenda.js/redis-backend
 *
 * Redis backend for Agenda job scheduler with Pub/Sub notification support.
 *
 * @example
 * ```typescript
 * import { Agenda } from 'agenda';
 * import { RedisBackend } from '@agenda.js/redis-backend';
 *
 * // Create agenda with Redis backend
 * const agenda = new Agenda({
 *   backend: new RedisBackend({
 *     connectionString: 'redis://localhost:6379'
 *   })
 * });
 *
 * // Define and run jobs
 * agenda.define('myJob', async (job) => {
 *   console.log('Running job:', job.attrs.name);
 * });
 *
 * await agenda.start();
 * await agenda.every('5 minutes', 'myJob');
 * ```
 */

export { RedisBackend } from './RedisBackend.js';
export { RedisJobRepository } from './RedisJobRepository.js';
export { RedisNotificationChannel } from './RedisNotificationChannel.js';

export type { IRedisBackendConfig, IRedisJobData } from './types.js';
export type { IRedisNotificationChannelConfig } from './RedisNotificationChannel.js';
