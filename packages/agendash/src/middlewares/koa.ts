import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Agenda } from 'agenda';
import type { Middleware, Context, Next } from 'koa';
import { AgendashController } from '../AgendashController.js';
import { cspHeader } from '../csp.js';
import type { ApiQueryParams, CreateJobRequest, DeleteRequest, RequeueRequest, PauseRequest, ResumeRequest } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Create Koa middleware array for Agendash (sync version)
 * Note: This returns only the CSP middleware. Use createKoaMiddlewareAsync for full setup.
 *
 * @deprecated Use createKoaMiddlewareAsync instead for complete middleware setup
 * @example
 * ```typescript
 * import Koa from 'koa';
 * import { Agenda } from 'agenda';
 * import { createKoaMiddlewareAsync } from 'agendash';
 *
 * const app = new Koa();
 * const agenda = new Agenda({ db: { address: 'mongodb://localhost/agenda' } });
 *
 * const middlewares = await createKoaMiddlewareAsync(agenda);
 * middlewares.forEach(mw => app.use(mw));
 * ```
 */
export function createKoaMiddleware(_agenda: Agenda): Middleware[] {
	const middlewares: Middleware[] = [];

	// CSP header middleware
	middlewares.push(async (ctx: Context, next: Next) => {
		await next();
		ctx.set('Content-Security-Policy', cspHeader);
	});

	// Return initial middleware; use createKoaMiddlewareAsync for full setup
	return middlewares;
}

/**
 * Async version that fully sets up all middlewares
 */
export async function createKoaMiddlewareAsync(agenda: Agenda): Promise<Middleware[]> {
	const controller = new AgendashController(agenda);
	const middlewares: Middleware[] = [];

	// CSP header middleware
	middlewares.push(async (ctx: Context, next: Next) => {
		await next();
		ctx.set('Content-Security-Policy', cspHeader);
	});

	const [{ default: koaStatic }, { default: bodyParser }, { default: Router }] = await Promise.all([
		import('koa-static'),
		import('koa-bodyparser'),
		import('koa-router')
	]);

	// Static files (deferred to run after routes)
	middlewares.push(koaStatic(join(__dirname, '../../public'), { defer: true }) as Middleware);

	// Body parser
	middlewares.push(bodyParser());

	// API routes
	const router = new Router();

	router.get('/api', async (ctx) => {
		const query = ctx.query as Record<string, string | undefined>;
		try {
			const params: ApiQueryParams = {
				name: query.job,
				state: query.state,
				search: query.q,
				property: query.property,
				isObjectId: query.isObjectId,
				skip: query.skip ? parseInt(query.skip, 10) : 0,
				limit: query.limit ? parseInt(query.limit, 10) : 50
			};
			ctx.body = await controller.getJobs(params);
		} catch (error) {
			ctx.status = 400;
			ctx.body = { error: error instanceof Error ? error.message : 'Unknown error' };
		}
	});

	router.post('/api/jobs/requeue', async (ctx) => {
		try {
			const { jobIds } = ctx.request.body as RequeueRequest;
			ctx.body = await controller.requeueJobs(jobIds);
		} catch (error) {
			ctx.status = 404;
			ctx.body = { error: error instanceof Error ? error.message : 'Unknown error' };
		}
	});

	router.post('/api/jobs/delete', async (ctx) => {
		try {
			const { jobIds } = ctx.request.body as DeleteRequest;
			ctx.body = await controller.deleteJobs(jobIds);
		} catch (error) {
			ctx.status = 404;
			ctx.body = { error: error instanceof Error ? error.message : 'Unknown error' };
		}
	});

	router.post('/api/jobs/create', async (ctx) => {
		try {
			const options = ctx.request.body as CreateJobRequest;
			ctx.body = await controller.createJob(options);
		} catch (error) {
			ctx.status = 400;
			ctx.body = { error: error instanceof Error ? error.message : 'Unknown error' };
		}
	});

	router.post('/api/jobs/pause', async (ctx) => {
		try {
			const { jobIds } = ctx.request.body as PauseRequest;
			ctx.body = await controller.pauseJobs(jobIds);
		} catch (error) {
			ctx.status = 400;
			ctx.body = { error: error instanceof Error ? error.message : 'Unknown error' };
		}
	});

	router.post('/api/jobs/resume', async (ctx) => {
		try {
			const { jobIds } = ctx.request.body as ResumeRequest;
			ctx.body = await controller.resumeJobs(jobIds);
		} catch (error) {
			ctx.status = 400;
			ctx.body = { error: error instanceof Error ? error.message : 'Unknown error' };
		}
	});

	router.get('/api/stats', async (ctx) => {
		try {
			const fullDetails = ctx.query.fullDetails === 'true';
			ctx.body = await controller.getStats(fullDetails);
		} catch (error) {
			ctx.status = 500;
			ctx.body = { error: error instanceof Error ? error.message : 'Unknown error' };
		}
	});

	// SSE endpoint for real-time job state notifications
	router.get('/api/events', async (ctx) => {
		// Check if state notifications are available
		if (!controller.hasStateNotifications()) {
			ctx.status = 501;
			ctx.body = { error: 'State notifications not available. Configure a notification channel that supports state subscriptions.' };
			return;
		}

		// Set up SSE headers
		ctx.set('Content-Type', 'text/event-stream');
		ctx.set('Cache-Control', 'no-cache');
		ctx.set('Connection', 'keep-alive');
		ctx.set('X-Accel-Buffering', 'no'); // Disable nginx buffering

		// Use a passthrough stream for SSE
		const { PassThrough } = await import('stream');
		const stream = new PassThrough();
		ctx.body = stream;

		// Send initial connection message
		stream.write('event: connected\ndata: {"connected":true}\n\n');

		// Subscribe to state notifications
		const unsubscribe = controller.createStateStream((notification) => {
			stream.write(`data: ${JSON.stringify(notification)}\n\n`);
		});

		// Clean up on client disconnect
		ctx.req.on('close', () => {
			unsubscribe();
			stream.end();
		});
	});

	middlewares.push(router.routes() as Middleware);
	middlewares.push(router.allowedMethods() as Middleware);

	return middlewares;
}
