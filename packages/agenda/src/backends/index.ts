/**
 * Backend implementations have been moved to separate packages:
 *
 * - MongoDB: @agenda.js/mongo-backend
 * - PostgreSQL: @agenda.js/postgres-backend
 * - Redis: @agenda.js/redis-backend
 *
 * @example
 * ```typescript
 * import { Agenda } from 'agenda';
 * import { MongoBackend } from '@agenda.js/mongo-backend';
 *
 * const agenda = new Agenda({
 *   backend: new MongoBackend({ address: 'mongodb://localhost/agenda' })
 * });
 * ```
 */

// No exports - backends are in separate packages
