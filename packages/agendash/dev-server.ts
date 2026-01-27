/**
 * Development server that runs both Vite (frontend) and Express API (backend)
 * Uses mongodb-memory-server by default for easy testing
 *
 * Usage: pnpm --filter agendash dev
 * With external MongoDB: MONGO_URL=mongodb://localhost:27017/mydb pnpm --filter agendash dev
 * Fill with 10,000 jobs: FILL_JOBS=true pnpm --filter agendash dev
 */
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { Agenda } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';
import { createExpressMiddleware } from './src/middlewares/express.js';

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

async function fillWithJobs(agenda: Agenda, count: number): Promise<void> {
	console.log(`\nFilling database with ${count} jobs...`);
	const startTime = Date.now();

	const jobTypes = ['test-job', 'failing-job', 'slow-job', 'future-job'];
	const priorities = ['lowest', 'low', 'normal', 'high', 'highest'] as const;
	const batchSize = 500;

	for (let i = 0; i < count; i += batchSize) {
		const jobs = [];
		const currentBatchSize = Math.min(batchSize, count - i);

		for (let j = 0; j < currentBatchSize; j++) {
			const index = i + j;
			const jobType = jobTypes[index % jobTypes.length];
			const priority = priorities[index % priorities.length];

			// Create varied scheduling times
			let scheduleDate: Date;
			const variation = index % 10;

			if (variation < 3) {
				// 30% scheduled in the past (completed/failed simulation)
				scheduleDate = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
			} else if (variation < 6) {
				// 30% scheduled for near future (queued)
				scheduleDate = new Date(Date.now() + Math.random() * 60 * 60 * 1000);
			} else if (variation < 8) {
				// 20% scheduled for days ahead
				scheduleDate = new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000);
			} else {
				// 20% scheduled for months ahead
				scheduleDate = new Date(Date.now() + Math.random() * 365 * 24 * 60 * 60 * 1000);
			}

			const job = agenda.create(jobType, {
				index,
				batch: Math.floor(index / 100),
				category: ['email', 'notification', 'sync', 'cleanup', 'report'][index % 5],
				userId: `user-${index % 1000}`,
				createdAt: new Date().toISOString()
			});

			job.schedule(scheduleDate);
			job.priority(priority);

			// Simulate some completed/failed jobs by setting lastFinishedAt
			if (variation < 2) {
				// ~20% completed successfully
				job.attrs.lastFinishedAt = new Date(scheduleDate.getTime() + 1000);
				job.attrs.lastRunAt = scheduleDate;
				job.attrs.nextRunAt = undefined;
			} else if (variation === 2) {
				// ~10% failed
				job.attrs.lastFinishedAt = new Date(scheduleDate.getTime() + 1000);
				job.attrs.lastRunAt = scheduleDate;
				job.attrs.failedAt = new Date(scheduleDate.getTime() + 1000);
				job.attrs.failReason = 'Simulated failure for testing';
				job.attrs.failCount = Math.floor(Math.random() * 5) + 1;
				job.attrs.nextRunAt = undefined;
			}

			jobs.push(job);
		}

		// Save batch
		await Promise.all(jobs.map((job) => job.save()));

		const progress = Math.min(100, Math.round(((i + currentBatchSize) / count) * 100));
		process.stdout.write(`\r  Progress: ${progress}% (${i + currentBatchSize}/${count} jobs)`);
	}

	const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
	console.log(`\n  Completed in ${elapsed}s\n`);
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

	// Fill with 10,000 jobs if FILL_JOBS is set
	if (process.env.FILL_JOBS === 'true') {
		await fillWithJobs(agenda, 10000);
	}

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

	// Create Vite server in middleware mode for frontend hot-reloading
	const vite = await createViteServer({
		configFile: resolve(__dirname, 'client/vite.config.ts'),
		server: {
			middlewareMode: true
		},
		appType: 'spa'
	});

	// API routes (skip static files - Vite handles frontend in dev mode)
	app.use('/', createExpressMiddleware(agenda, { skipStaticFiles: true }));

	// Use Vite for frontend (handles HMR and serves all non-API requests)
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
