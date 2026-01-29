/**
 * @agendajs/postgres-backend
 *
 * PostgreSQL backend for Agenda job scheduler with LISTEN/NOTIFY support.
 *
 * @example
 * ```typescript
 * import { Agenda } from 'agenda';
 * import { PostgresBackend } from '@agendajs/postgres-backend';
 *
 * // Create agenda with PostgreSQL backend
 * const agenda = new Agenda({
 *   backend: new PostgresBackend({
 *     connectionString: 'postgresql://user:pass@localhost:5432/mydb'
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

export { PostgresBackend } from './PostgresBackend.js';
export { PostgresJobRepository } from './PostgresJobRepository.js';
export { PostgresJobLogger } from './PostgresJobLogger.js';
export { PostgresNotificationChannel } from './PostgresNotificationChannel.js';

export type { PostgresBackendConfig, PostgresJobRow } from './types.js';
export type { PostgresNotificationChannelConfig } from './PostgresNotificationChannel.js';

// Re-export schema utilities for advanced use cases
export {
	getCreateTableSQL,
	getCreateIndexesSQL,
	getDropTableSQL,
	getUpdateTimestampTriggerSQL
} from './schema.js';
export { getCreateLogsTableSQL, getCreateLogsIndexesSQL } from './PostgresJobLogger.js';
