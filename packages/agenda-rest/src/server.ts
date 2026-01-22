import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';
import type { Job } from 'agenda';
import type {
	IAgendaRestConfig,
	IJobDefinitionRequest,
	IScheduleJobRequest,
	ICancelJobRequest
} from './types.js';

/**
 * Job definitions stored in memory (for webhook-style jobs)
 */
interface IStoredJobDefinition {
	name: string;
	url?: string;
	method?: string;
	headers?: Record<string, string>;
	body?: unknown;
	callback?: {
		url: string;
		method?: string;
		headers?: Record<string, string>;
	};
}

/**
 * Create a Koa application for the agenda-rest API
 */
export function createServer(config: IAgendaRestConfig): Koa {
	const { agenda, apiKey } = config;

	if (!agenda) {
		throw new Error('Agenda instance is required');
	}

	const app = new Koa();
	const router = new Router({ prefix: '/api' });

	// In-memory job definitions (for webhook-style job configs)
	const jobDefinitions = new Map<string, IStoredJobDefinition>();

	// Middleware for API key authentication
	const authenticate = async (ctx: Koa.Context, next: Koa.Next) => {
		if (apiKey && ctx.request.headers['x-api-key'] !== apiKey) {
			ctx.status = 403;
			ctx.body = { error: 'Forbidden: Invalid API key' };
			return;
		}
		await next();
	};

	// Define a job dynamically
	const ensureJobDefined = (name: string) => {
		if (!agenda.definitions[name]) {
			agenda.define(name, async (job: Job) => {
				const def = jobDefinitions.get(name);
				if (def?.url) {
					// Execute webhook
					const method = def.method || 'POST';
					const headers = def.headers || {};
					const body = job.attrs.data ?? def.body;

					try {
						const response = await fetch(def.url, {
							method,
							headers: {
								'Content-Type': 'application/json',
								...headers
							},
							body: body ? JSON.stringify(body) : undefined
						});

						// Handle callback if configured
						if (def.callback?.url) {
							await fetch(def.callback.url, {
								method: def.callback.method || 'POST',
								headers: {
									'Content-Type': 'application/json',
									...def.callback.headers
								},
								body: JSON.stringify({
									job: name,
									status: response.ok ? 'success' : 'failed',
									statusCode: response.status
								})
							});
						}
					} catch (error) {
						console.error(`Job ${name} failed:`, error);
						throw error;
					}
				}
				// If no URL, job is just for data storage/triggering
			});
		}
	};

	// GET /api/job - List all job definitions
	router.get('/job', authenticate, async (ctx) => {
		const jobs = Array.from(jobDefinitions.values());
		ctx.body = { jobs };
	});

	// POST /api/job - Create a new job definition
	router.post('/job', authenticate, async (ctx) => {
		const body = ctx.request.body as IJobDefinitionRequest;

		if (!body.name) {
			ctx.status = 400;
			ctx.body = { error: 'Job name is required' };
			return;
		}

		if (jobDefinitions.has(body.name)) {
			ctx.status = 409;
			ctx.body = { error: `Job "${body.name}" already exists` };
			return;
		}

		jobDefinitions.set(body.name, body);
		ensureJobDefined(body.name);

		ctx.body = { success: true, message: `Job "${body.name}" created` };
	});

	// PUT /api/job/:jobName - Update a job definition
	router.put('/job/:jobName', authenticate, async (ctx) => {
		const { jobName } = ctx.params;
		const body = ctx.request.body as Partial<IJobDefinitionRequest>;

		if (!jobDefinitions.has(jobName)) {
			ctx.status = 404;
			ctx.body = { error: `Job "${jobName}" not found` };
			return;
		}

		const existing = jobDefinitions.get(jobName)!;
		jobDefinitions.set(jobName, { ...existing, ...body, name: jobName });

		ctx.body = { success: true, message: `Job "${jobName}" updated` };
	});

	// DELETE /api/job/:jobName - Delete a job definition
	router.delete('/job/:jobName', authenticate, async (ctx) => {
		const { jobName } = ctx.params;

		if (!jobDefinitions.has(jobName)) {
			ctx.status = 404;
			ctx.body = { error: `Job "${jobName}" not found` };
			return;
		}

		jobDefinitions.delete(jobName);
		// Cancel any scheduled instances
		await agenda.cancel({ name: jobName });

		ctx.body = { success: true, message: `Job "${jobName}" deleted` };
	});

	// POST /api/job/now - Run a job immediately
	router.post('/job/now', authenticate, async (ctx) => {
		const body = ctx.request.body as IScheduleJobRequest;

		if (!body.name) {
			ctx.status = 400;
			ctx.body = { error: 'Job name is required' };
			return;
		}

		ensureJobDefined(body.name);

		try {
			const job = await agenda.now(body.name, body.data);
			ctx.body = {
				success: true,
				message: `Job "${body.name}" scheduled to run now`,
				jobId: String(job.attrs._id)
			};
		} catch (error) {
			ctx.status = 500;
			ctx.body = { error: error instanceof Error ? error.message : 'Unknown error' };
		}
	});

	// POST /api/job/once - Schedule a job to run once at a specific time
	router.post('/job/once', authenticate, async (ctx) => {
		const body = ctx.request.body as IScheduleJobRequest;

		if (!body.name) {
			ctx.status = 400;
			ctx.body = { error: 'Job name is required' };
			return;
		}

		if (!body.when) {
			ctx.status = 400;
			ctx.body = { error: 'when is required for scheduling' };
			return;
		}

		ensureJobDefined(body.name);

		try {
			const job = await agenda.schedule(body.when, body.name, body.data);
			ctx.body = {
				success: true,
				message: `Job "${body.name}" scheduled`,
				jobId: String(job.attrs._id)
			};
		} catch (error) {
			ctx.status = 500;
			ctx.body = { error: error instanceof Error ? error.message : 'Unknown error' };
		}
	});

	// POST /api/job/every - Schedule a recurring job
	router.post('/job/every', authenticate, async (ctx) => {
		const body = ctx.request.body as IScheduleJobRequest;

		if (!body.name) {
			ctx.status = 400;
			ctx.body = { error: 'Job name is required' };
			return;
		}

		if (!body.interval) {
			ctx.status = 400;
			ctx.body = { error: 'interval is required for recurring jobs' };
			return;
		}

		ensureJobDefined(body.name);

		try {
			const job = await agenda.every(body.interval, body.name, body.data);
			ctx.body = {
				success: true,
				message: `Recurring job "${body.name}" scheduled every ${body.interval}`,
				jobId: String(job.attrs._id)
			};
		} catch (error) {
			ctx.status = 500;
			ctx.body = { error: error instanceof Error ? error.message : 'Unknown error' };
		}
	});

	// POST /api/job/cancel - Cancel matching jobs
	router.post('/job/cancel', authenticate, async (ctx) => {
		const body = ctx.request.body as ICancelJobRequest;

		if (!body.name && !body.data) {
			ctx.status = 400;
			ctx.body = { error: 'name or data is required to cancel jobs' };
			return;
		}

		try {
			const count = await agenda.cancel({
				name: body.name,
				data: body.data
			});
			ctx.body = {
				success: true,
				message: `Cancelled ${count} job(s)`,
				cancelledCount: count
			};
		} catch (error) {
			ctx.status = 500;
			ctx.body = { error: error instanceof Error ? error.message : 'Unknown error' };
		}
	});

	// Health check endpoint
	router.get('/health', async (ctx) => {
		ctx.body = { status: 'ok' };
	});

	// Apply middleware
	app.use(bodyParser());
	app.use(router.routes());
	app.use(router.allowedMethods());

	return app;
}
