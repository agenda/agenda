/**
 * Development server that runs both Vite (frontend) and Express API (backend)
 * Uses mongodb-memory-server by default for easy testing
 *
 * Usage: pnpm --filter agendash dev
 * With external MongoDB: MONGO_URL=mongodb://localhost:27017/mydb pnpm --filter agendash dev
 */
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { Agenda } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';
import { AgendashController } from './src/AgendashController.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function getMongoUrl(): Promise<{ url: string; cleanup?: () => Promise<void> }> {
	// Use external MongoDB if MONGO_URL is set
	if (process.env.MONGO_URL) {
		console.log(`Using external MongoDB: ${process.env.MONGO_URL}`);
		return { url: process.env.MONGO_URL };
	}

	// Otherwise, start an in-memory MongoDB server
	console.log('Starting in-memory MongoDB server...');
	const { MongoMemoryServer } = await import('mongodb-memory-server');
	const mongod = await MongoMemoryServer.create();
	const url = mongod.getUri();
	console.log(`In-memory MongoDB started: ${url}`);

	return {
		url,
		cleanup: async () => {
			await mongod.stop();
		}
	};
}

async function startDevServer() {
	const { url: mongoUrl, cleanup } = await getMongoUrl();

	const agenda = new Agenda({
		backend: new MongoBackend({ address: mongoUrl })
	});

	agenda.on('error', (err) => {
		console.error('Agenda error:', err);
	});

	// Define some test jobs
	agenda.define('test-job', async (job) => {
		console.log(`Running test-job with data:`, job.attrs.data);
	});

	agenda.define('failing-job', async () => {
		throw new Error('This job always fails');
	});

	agenda.define('slow-job', async () => {
		await new Promise((resolve) => setTimeout(resolve, 5000));
		console.log('Slow job completed');
	});

	agenda.define('long-running-job', async () => {
		console.log('Long running job started...');
		await new Promise((resolve) => setTimeout(resolve, 60000)); // 1 minute
		console.log('Long running job completed');
	});

	agenda.define('future-job', async (job) => {
		console.log('Future job executed:', job.attrs.data);
	});

	await agenda.start();

	// Schedule some recurring jobs for testing
	await agenda.every('1 minute', 'test-job', { example: 'data' });

	// Schedule a long-running job that starts immediately
	await agenda.now('long-running-job');

	// Schedule a job far in the future (1 year from now)
	const oneYearFromNow = new Date();
	oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
	await agenda.schedule(oneYearFromNow, 'future-job', { scheduled: 'for next year' });

	// Schedule another job 1 month from now
	const oneMonthFromNow = new Date();
	oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
	await agenda.schedule(oneMonthFromNow, 'future-job', { scheduled: 'for next month' });

	const app = express();
	app.use(express.json());

	// Create Vite server in middleware mode
	const vite = await createViteServer({
		configFile: resolve(__dirname, 'client/vite.config.ts'),
		server: {
			middlewareMode: true
		},
		appType: 'spa'
	});

	// API routes
	const controller = new AgendashController(agenda);

	app.get('/api', async (req, res) => {
		try {
			const result = await controller.getJobs({
				name: req.query.job as string,
				search: req.query.q as string,
				property: req.query.property as string,
				isObjectId: req.query.isObjectId as string,
				state: req.query.state as string,
				skip: req.query.skip ? parseInt(req.query.skip as string, 10) : undefined,
				limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined
			});
			res.json(result);
		} catch (err) {
			console.error('API error:', err);
			res.status(500).json({ error: 'Internal server error' });
		}
	});

	app.post('/api/jobs/requeue', async (req, res) => {
		try {
			const result = await controller.requeueJobs(req.body.jobIds);
			res.json(result);
		} catch (err) {
			console.error('API error:', err);
			res.status(500).json({ error: 'Internal server error' });
		}
	});

	app.post('/api/jobs/delete', async (req, res) => {
		try {
			const result = await controller.deleteJobs(req.body.jobIds);
			res.json(result);
		} catch (err) {
			console.error('API error:', err);
			res.status(500).json({ error: 'Internal server error' });
		}
	});

	app.post('/api/jobs/create', async (req, res) => {
		try {
			const result = await controller.createJob(req.body);
			res.json(result);
		} catch (err) {
			console.error('API error:', err);
			res.status(500).json({ error: 'Internal server error' });
		}
	});

	app.get('/api/stats', async (req, res) => {
		try {
			const fullDetails = req.query.fullDetails === 'true';
			const result = await controller.getStats(fullDetails);
			res.json(result);
		} catch (err) {
			console.error('API error:', err);
			res.status(500).json({ error: 'Internal server error' });
		}
	});

	// Use Vite's connect instance as middleware
	app.use(vite.middlewares);

	const port = parseInt(process.env.PORT || '3000', 10);

	app.listen(port, () => {
		console.log(`\n  Agendash dev server running at:`);
		console.log(`  > http://localhost:${port}\n`);
	});

	// Graceful shutdown
	process.on('SIGINT', async () => {
		console.log('\nShutting down...');
		await agenda.stop();
		await vite.close();
		if (cleanup) await cleanup();
		process.exit(0);
	});
}

startDevServer().catch((err) => {
	console.error('Failed to start dev server:', err);
	process.exit(1);
});
