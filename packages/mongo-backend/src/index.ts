/**
 * @agenda.js/mongo-backend
 *
 * MongoDB backend for Agenda job scheduler.
 *
 * @example
 * ```typescript
 * import { Agenda } from 'agenda';
 * import { MongoBackend } from '@agenda.js/mongo-backend';
 *
 * // Create agenda with MongoDB backend
 * const agenda = new Agenda({
 *   backend: new MongoBackend({
 *     address: 'mongodb://localhost/agenda'
 *   })
 * });
 *
 * // Or with existing connection
 * const agenda = new Agenda({
 *   backend: new MongoBackend({ mongo: existingDb })
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

export { MongoBackend } from './MongoBackend.js';
export { MongoJobRepository } from './MongoJobRepository.js';

export type { IMongoBackendConfig, IMongoJobRepositoryConfig, IMongoDbConfig } from './types.js';

// Re-export mongodb types that users might need
export type { Db, MongoClientOptions, SortDirection } from 'mongodb';
