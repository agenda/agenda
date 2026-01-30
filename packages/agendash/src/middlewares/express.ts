import { Router, static as serveStatic, json, urlencoded } from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Agenda } from 'agenda';
import { AgendashController } from '../AgendashController.js';
import { cspHeader } from '../csp.js';
import type { ApiQueryParams, CreateJobRequest, DeleteRequest, RequeueRequest, PauseRequest, ResumeRequest, LogsQueryParams } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface ExpressMiddlewareOptions {
	/** Skip static file serving (useful for dev mode with Vite) */
	skipStaticFiles?: boolean;
}

/**
 * Create Express middleware for Agendash
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { Agenda } from 'agenda';
 * import { createExpressMiddleware } from 'agendash';
 *
 * const app = express();
 * const agenda = new Agenda({ db: { address: 'mongodb://localhost/agenda' } });
 *
 * app.use('/dash', createExpressMiddleware(agenda));
 * ```
 */
export function createExpressMiddleware(agenda: Agenda, options: ExpressMiddlewareOptions = {}): Router {
	const controller = new AgendashController(agenda);
	const router = Router();

	// Body parsing
	router.use(json());
	router.use(urlencoded({ extended: false }));

	// CSP header
	router.use((_req, res, next) => {
		res.header('Content-Security-Policy', cspHeader);
		next();
	});

	// Static files (skip in dev mode when using Vite)
	if (!options.skipStaticFiles) {
		router.use('/', serveStatic(join(__dirname, '../../public')));
	}

	// API routes
	router.get('/api', async (req, res) => {
		try {
			const query = req.query as Record<string, string | undefined>;
			const params: ApiQueryParams = {
				name: query.job,
				state: query.state,
				search: query.q,
				property: query.property,
				isObjectId: query.isObjectId,
				skip: query.skip ? parseInt(query.skip, 10) : 0,
				limit: query.limit ? parseInt(query.limit, 10) : 50
			};
			const result = await controller.getJobs(params);
			res.json(result);
		} catch (error) {
			res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
		}
	});

	router.post('/api/jobs/requeue', async (req, res) => {
		try {
			const { jobIds } = req.body as RequeueRequest;
			const result = await controller.requeueJobs(jobIds);
			res.json(result);
		} catch (error) {
			res.status(404).json({ error: error instanceof Error ? error.message : 'Unknown error' });
		}
	});

	router.post('/api/jobs/delete', async (req, res) => {
		try {
			const { jobIds } = req.body as DeleteRequest;
			const result = await controller.deleteJobs(jobIds);
			res.json(result);
		} catch (error) {
			res.status(404).json({ error: error instanceof Error ? error.message : 'Unknown error' });
		}
	});

	router.post('/api/jobs/create', async (req, res) => {
		try {
			const options = req.body as CreateJobRequest;
			const result = await controller.createJob(options);
			res.json(result);
		} catch (error) {
			res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
		}
	});

	router.post('/api/jobs/pause', async (req, res) => {
		try {
			const { jobIds } = req.body as PauseRequest;
			const result = await controller.pauseJobs(jobIds);
			res.json(result);
		} catch (error) {
			res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
		}
	});

	router.post('/api/jobs/resume', async (req, res) => {
		try {
			const { jobIds } = req.body as ResumeRequest;
			const result = await controller.resumeJobs(jobIds);
			res.json(result);
		} catch (error) {
			res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
		}
	});

	router.get('/api/stats', async (req, res) => {
		try {
			const fullDetails = req.query.fullDetails === 'true';
			const result = await controller.getStats(fullDetails);
			res.json(result);
		} catch (error) {
			res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
		}
	});

	// Logs endpoint
	router.get('/api/logs', async (req, res) => {
		try {
			const query = req.query as Record<string, string | undefined>;
			const params: LogsQueryParams = {
				jobId: query.jobId,
				jobName: query.jobName,
				level: query.level,
				event: query.event,
				from: query.from,
				to: query.to,
				limit: query.limit ? parseInt(query.limit, 10) : 50,
				offset: query.offset ? parseInt(query.offset, 10) : 0,
				sort: (query.sort as 'asc' | 'desc') || 'desc'
			};
			const result = await controller.getLogs(params);
			res.json(result);
		} catch (error) {
			res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
		}
	});

	// SSE endpoint for real-time job state notifications
	router.get('/api/events', (req, res) => {
		// Check if state notifications are available
		if (!controller.hasStateNotifications()) {
			res.status(501).json({ error: 'State notifications not available. Configure a notification channel that supports state subscriptions.' });
			return;
		}

		// Set up SSE headers
		res.setHeader('Content-Type', 'text/event-stream');
		res.setHeader('Cache-Control', 'no-cache');
		res.setHeader('Connection', 'keep-alive');
		res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

		// Send initial connection message
		res.write('event: connected\ndata: {"connected":true}\n\n');

		// Subscribe to state notifications
		const unsubscribe = controller.createStateStream((notification) => {
			res.write(`data: ${JSON.stringify(notification)}\n\n`);
		});

		// Clean up on client disconnect
		req.on('close', () => {
			unsubscribe();
		});
	});

	return router;
}
