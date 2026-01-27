import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Agenda } from 'agenda';
import type { FastifyInstance, FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import { AgendashController } from '../AgendashController.js';
import { cspHeader } from '../csp.js';
import type { ApiQueryParams, CreateJobRequest, DeleteRequest, RequeueRequest, PauseRequest, ResumeRequest } from '../types.js';

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
					const params: ApiQueryParams = {
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

		instance.post<{ Body: RequeueRequest }>(
			'/api/jobs/requeue',
			async (request: FastifyRequest<{ Body: RequeueRequest }>, reply: FastifyReply) => {
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

		instance.post<{ Body: DeleteRequest }>(
			'/api/jobs/delete',
			async (request: FastifyRequest<{ Body: DeleteRequest }>, reply: FastifyReply) => {
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

		instance.post<{ Body: CreateJobRequest }>(
			'/api/jobs/create',
			async (request: FastifyRequest<{ Body: CreateJobRequest }>, reply: FastifyReply) => {
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

		instance.post<{ Body: PauseRequest }>(
			'/api/jobs/pause',
			async (request: FastifyRequest<{ Body: PauseRequest }>, reply: FastifyReply) => {
				try {
					const { jobIds } = request.body;
					const result = await controller.pauseJobs(jobIds);
					return reply.send(result);
				} catch (error) {
					return reply
						.status(400)
						.send({ error: error instanceof Error ? error.message : 'Unknown error' });
				}
			}
		);

		instance.post<{ Body: ResumeRequest }>(
			'/api/jobs/resume',
			async (request: FastifyRequest<{ Body: ResumeRequest }>, reply: FastifyReply) => {
				try {
					const { jobIds } = request.body;
					const result = await controller.resumeJobs(jobIds);
					return reply.send(result);
				} catch (error) {
					return reply
						.status(400)
						.send({ error: error instanceof Error ? error.message : 'Unknown error' });
				}
			}
		);

		instance.get<{ Querystring: { fullDetails?: string } }>(
			'/api/stats',
			async (request: FastifyRequest<{ Querystring: { fullDetails?: string } }>, reply: FastifyReply) => {
				try {
					const fullDetails = request.query.fullDetails === 'true';
					const result = await controller.getStats(fullDetails);
					return reply.send(result);
				} catch (error) {
					return reply
						.status(500)
						.send({ error: error instanceof Error ? error.message : 'Unknown error' });
				}
			}
		);
	};
}
