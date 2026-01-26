/**
 * Backend implementations have been moved to separate packages:
 *
 * - MongoDB: @agendajs/mongo-backend
 * - PostgreSQL: @agendajs/postgres-backend
 * - Redis: @agendajs/redis-backend
 *
 * @example
 * ```typescript
 * import { Agenda } from 'agenda';
 * import { MongoBackend } from '@agendajs/mongo-backend';
 *
 * const agenda = new Agenda({
 *   backend: new MongoBackend({ address: 'mongodb://localhost/agenda' })
 * });
 * ```
 */

// No exports - backends are in separate packages
