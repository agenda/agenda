import { Router, static as serveStatic, json, urlencoded } from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Agenda } from 'agenda';
import { AgendashController } from '../AgendashController.js';
import { cspHeader } from '../csp.js';
import type { ApiQueryParams, CreateJobRequest, DeleteRequest, RequeueRequest, PauseRequest, ResumeRequest } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
export function createExpressMiddleware(agenda: Agenda): Router {
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

	// Static files
	router.use('/', serveStatic(join(__dirname, '../../public')));

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

	return router;
}
