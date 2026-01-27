import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Agenda } from 'agenda';
import type { Server, Plugin, Request, ResponseToolkit } from '@hapi/hapi';
import { AgendashController } from '../AgendashController.js';
import { cspHeader } from '../csp.js';
import type { ApiQueryParams, CreateJobRequest, DeleteRequest, RequeueRequest } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface AgendashHapiOptions {
	auth?: string | false;
}

interface ApiQuery {
	job?: string;
	state?: string;
	q?: string;
	property?: string;
	isObjectId?: string;
	skip?: string;
	limit?: string;
}

/**
 * Create Hapi plugin for Agendash
 *
 * @example
 * ```typescript
 * import Hapi from '@hapi/hapi';
 * import Inert from '@hapi/inert';
 * import { Agenda } from 'agenda';
 * import { createHapiPlugin } from 'agendash';
 *
 * const server = Hapi.server({ port: 3000 });
 * const agenda = new Agenda({ db: { address: 'mongodb://localhost/agenda' } });
 *
 * await server.register(Inert);
 * await server.register({
 *   plugin: createHapiPlugin(agenda),
 *   options: { auth: false },
 *   routes: { prefix: '/dash' }
 * });
 * ```
 */
export function createHapiPlugin(agenda: Agenda): Plugin<AgendashHapiOptions> {
	const controller = new AgendashController(agenda);

	return {
		name: 'agendash',
		version: '6.0.0',
		register: async (server: Server, options: AgendashHapiOptions) => {
			const authConfig = options.auth ?? false;

			// CSP header on all responses
			server.ext('onPreResponse', (request, h) => {
				const response = request.response;
				if ('header' in response && typeof response.header === 'function') {
					response.header('Content-Security-Policy', cspHeader);
				}
				return h.continue;
			});

			// Static files
			server.route({
				method: 'GET',
				path: '/{param*}',
				handler: {
					directory: {
						path: join(__dirname, '../../public')
					}
				},
				options: {
					auth: authConfig
				}
			});

			// API routes
			server.route({
				method: 'GET',
				path: '/api',
				handler: async (request: Request, h: ResponseToolkit) => {
					try {
						const query = request.query as ApiQuery;
						const params: ApiQueryParams = {
							name: query.job,
							state: query.state,
							search: query.q,
							property: query.property,
							isObjectId: query.isObjectId,
							skip: query.skip ? parseInt(query.skip, 10) : 0,
							limit: query.limit ? parseInt(query.limit, 10) : 50
						};
						return await controller.getJobs(params);
					} catch (error) {
						return h
							.response({ error: error instanceof Error ? error.message : 'Unknown error' })
							.code(400);
					}
				},
				options: {
					auth: authConfig
				}
			});

			server.route({
				method: 'POST',
				path: '/api/jobs/requeue',
				handler: async (request: Request, h: ResponseToolkit) => {
					try {
						const { jobIds } = request.payload as RequeueRequest;
						return await controller.requeueJobs(jobIds);
					} catch (error) {
						return h
							.response({ error: error instanceof Error ? error.message : 'Unknown error' })
							.code(404);
					}
				},
				options: {
					auth: authConfig
				}
			});

			server.route({
				method: 'POST',
				path: '/api/jobs/delete',
				handler: async (request: Request, h: ResponseToolkit) => {
					try {
						const { jobIds } = request.payload as DeleteRequest;
						const result = await controller.deleteJobs(jobIds);
						if (result.deleted) {
							return h.response(result);
						}
						return h.response({ message: 'Jobs not deleted' }).code(404);
					} catch (error) {
						return h
							.response({ error: error instanceof Error ? error.message : 'Unknown error' })
							.code(404);
					}
				},
				options: {
					auth: authConfig
				}
			});

			server.route({
				method: 'POST',
				path: '/api/jobs/create',
				handler: async (request: Request, h: ResponseToolkit) => {
					try {
						const options = request.payload as CreateJobRequest;
						return await controller.createJob(options);
					} catch (error) {
						return h
							.response({ error: error instanceof Error ? error.message : 'Unknown error' })
							.code(400);
					}
				},
				options: {
					auth: authConfig
				}
			});

			server.route({
				method: 'GET',
				path: '/api/stats',
				handler: async (request: Request, h: ResponseToolkit) => {
					try {
						const fullDetails = (request.query as { fullDetails?: string }).fullDetails === 'true';
						return await controller.getStats(fullDetails);
					} catch (error) {
						return h
							.response({ error: error instanceof Error ? error.message : 'Unknown error' })
							.code(500);
					}
				},
				options: {
					auth: authConfig
				}
			});
		}
	};
}
