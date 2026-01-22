import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Agenda } from 'agenda';
import type { FastifyInstance, FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import { AgendashController } from '../AgendashController.js';
import { cspHeader } from '../csp.js';
import type { IApiQueryParams, ICreateJobRequest, IDeleteRequest, IRequeueRequest } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface ApiQuerystring {
	job?: string;
	state?: string;
	q?: string;
	property?: string;
	isObjectId?: string;
	skip?: string;
	limit?: string;
}

/**
 * Create Fastify plugin for Agendash
 *
 * @example
 * ```typescript
 * import Fastify from 'fastify';
 * import { Agenda } from 'agenda';
 * import { createFastifyPlugin } from 'agendash';
 *
 * const fastify = Fastify();
 * const agenda = new Agenda({ db: { address: 'mongodb://localhost/agenda' } });
 *
 * fastify.register(createFastifyPlugin(agenda), { prefix: '/dash' });
 * ```
 */
export function createFastifyPlugin(agenda: Agenda): FastifyPluginCallback {
	const controller = new AgendashController(agenda);

	return async (instance: FastifyInstance) => {
		// Register static file serving
		const fastifyStatic = await import('@fastify/static');
		await instance.register(fastifyStatic.default, {
			root: join(__dirname, '../../public')
		});

		// Index route with CSP header
		instance.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
			reply.header('Content-Security-Policy', cspHeader);
			return reply.sendFile('index.html');
		});

		// API routes
		instance.get<{ Querystring: ApiQuerystring }>(
			'/api',
			async (request: FastifyRequest<{ Querystring: ApiQuerystring }>, reply: FastifyReply) => {
				try {
					const { job, state, q, property, isObjectId, skip, limit } = request.query;
					const params: IApiQueryParams = {
						name: job,
						state,
						search: q,
						property,
						isObjectId,
						skip: skip ? parseInt(skip, 10) : 0,
						limit: limit ? parseInt(limit, 10) : 50
					};
					const result = await controller.getJobs(params);
					return reply.send(result);
				} catch (error) {
					return reply
						.status(400)
						.send({ error: error instanceof Error ? error.message : 'Unknown error' });
				}
			}
		);

		instance.post<{ Body: IRequeueRequest }>(
			'/api/jobs/requeue',
			async (request: FastifyRequest<{ Body: IRequeueRequest }>, reply: FastifyReply) => {
				try {
					const { jobIds } = request.body;
					const result = await controller.requeueJobs(jobIds);
					return reply.send(result);
				} catch (error) {
					return reply
						.status(404)
						.send({ error: error instanceof Error ? error.message : 'Unknown error' });
				}
			}
		);

		instance.post<{ Body: IDeleteRequest }>(
			'/api/jobs/delete',
			async (request: FastifyRequest<{ Body: IDeleteRequest }>, reply: FastifyReply) => {
				try {
					const { jobIds } = request.body;
					const result = await controller.deleteJobs(jobIds);
					return reply.send(result);
				} catch (error) {
					return reply
						.status(404)
						.send({ error: error instanceof Error ? error.message : 'Unknown error' });
				}
			}
		);

		instance.post<{ Body: ICreateJobRequest }>(
			'/api/jobs/create',
			async (request: FastifyRequest<{ Body: ICreateJobRequest }>, reply: FastifyReply) => {
				try {
					const result = await controller.createJob(request.body);
					return reply.send(result);
				} catch (error) {
					return reply
						.status(400)
						.send({ error: error instanceof Error ? error.message : 'Unknown error' });
				}
			}
		);
	};
}
