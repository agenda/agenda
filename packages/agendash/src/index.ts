/**
 * Agendash - Dashboard for Agenda job scheduler
 *
 * @packageDocumentation
 */

// Core exports
export { AgendashController } from './AgendashController.js';
export * from './types.js';
export { cspHeader } from './csp.js';

// Express middleware (most common)
export { createExpressMiddleware } from './middlewares/express.js';

// Other middlewares - exported from subpaths for tree-shaking
export { createKoaMiddleware, createKoaMiddlewareAsync } from './middlewares/koa.js';
export { createFastifyPlugin } from './middlewares/fastify.js';
export { createHapiPlugin } from './middlewares/hapi.js';
