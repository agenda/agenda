/**
 * Development server that runs both Vite (frontend) and Express API (backend) with PostgreSQL
 * Automatically starts a Docker or Podman container if PostgreSQL is not available.
 *
 * Usage: pnpm --filter agendash dev:postgres
 * With custom connection: POSTGRES_URL=postgres://user:pass@localhost:5432/mydb pnpm --filter agendash dev:postgres
 * Fill with 10,000 jobs: FILL_JOBS=true pnpm --filter agendash dev:postgres
 */
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { Pool } from 'pg';
import { Agenda } from 'agenda';
import { PostgresBackend } from '@agendajs/postgres-backend';
import { createExpressMiddleware } from './src/middlewares/express.js';
import { containerRuntime } from 'agenda/dist/utils/container-runtime';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_POSTGRES_URL = 'postgresql://agenda:agenda@localhost:5433/agenda_dev';
const CONTAINER_NAME = 'agendash-postgres-dev';
let containerStartedByUs = false;

async function startDevServer() {
	const postgresUrl = await _ensurePostgres();

	// PostgresBackend provides both storage AND real-time notifications via LISTEN/NOTIFY
	const backend = new PostgresBackend({ connectionString: postgresUrl });

	const agenda = new Agenda({
		backend,
		name: 'agendash-dev-postgres',
		logging: true
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

	agenda.define('progress-job', async (job) => {
		console.log('Progress job started...');
		const steps = 10;
		for (let i = 1; i <= steps; i++) {
			await new Promise((resolve) => setTimeout(resolve, 3000)); // 3 seconds per step
			const progress = Math.round((i / steps) * 100);
			await job.touch(progress);
			console.log(`Progress job: ${progress}%`);
		}
		console.log('Progress job completed');
	});

	// Restart progress-job when it completes (reuse the same job)
	agenda.on('success:progress-job', async (job) => {
		console.log('Progress job succeeded, rescheduling...');
		job.schedule('now');
		await job.save();
	});

	agenda.define('future-job', async (job) => {
		console.log('Future job executed:', job.attrs.data);
	});

	await agenda.start();
	console.log('Agenda started with PostgreSQL backend (LISTEN/NOTIFY enabled for real-time updates)');

	// Fill with 10,000 jobs if FILL_JOBS is set
	if (process.env.FILL_JOBS === 'true') {
		await _fillWithJobs(agenda, 10000);
	}

	// Schedule some recurring jobs for testing
	await agenda.every('1 minute', 'test-job', { example: 'data' });

	// Schedule a long-running job that starts immediately
	await agenda.now('long-running-job');

	// Schedule a job that updates its progress
	await agenda.now('progress-job');

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

	const port = parseInt(process.env.PORT || '3001', 10);

	app.listen(port, () => {
		console.log(`\n  Agendash dev server (PostgreSQL) running at:`);
		console.log(`  > http://localhost:${port}`);
		console.log(`  > Real-time updates: ENABLED (via PostgreSQL LISTEN/NOTIFY)\n`);
	});

	// Graceful shutdown
	process.on('SIGINT', async () => {
		console.log('\nShutting down...');
		await agenda.stop();
		await vite.close();
		await backend.disconnect();
		await _stopDockerContainer();
		process.exit(0);
	});
}

async function _ensurePostgres(): Promise<string> {
	const testUrl = process.env.POSTGRES_URL || DEFAULT_POSTGRES_URL;

	// First, check if PostgreSQL is already available
	if (await _isPostgresReady(testUrl)) {
		console.log('✓ Connected to PostgreSQL');
		return testUrl;
	}

	// PostgreSQL not available - try to start container
	console.log('PostgreSQL not available, attempting to start container...');

	const runtime = await containerRuntime.getRuntime();

	if (!runtime) {
		throw new Error(
			'PostgreSQL is not available and no container runtime (Docker or Podman) is installed.\n' +
				'Please either:\n' +
				'  1. Install Docker or Podman\n' +
				'  2. Set POSTGRES_URL to an existing PostgreSQL database'
		);
	}

	if (!(await _startDockerContainer())) {
		throw new Error(`Failed to start PostgreSQL container with ${runtime}.`);
	}

	console.log('⏳ Waiting for PostgreSQL to be ready');
	if (await _waitForPostgres(testUrl)) {
		console.log('\n✓ PostgreSQL is ready');
		return testUrl;
	}

	throw new Error('PostgreSQL container started but failed to become ready in time.');
}

async function _isPostgresReady(url: string): Promise<boolean> {
	const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 2000 });
	try {
		await pool.query('SELECT 1');
		return true;
	} catch {
		return false;
	} finally {
		await pool.end();
	}
}

async function _startContainer() {
	const runtime = await containerRuntime.getRuntime();
	if (!runtime) {
		throw new Error('No container runtime available');
	}
	await containerRuntime.startContainer(CONTAINER_NAME);
	console.log('✓ PostgreSQL container started');
}

async function _startNewContainer() {
	const runtime = await containerRuntime.getRuntime();
	if (!runtime) {
		throw new Error('No container runtime available');
	}

	await containerRuntime.runContainer(CONTAINER_NAME, {
		image: 'postgres:16-alpine',
		env: {
			POSTGRES_USER: 'agenda',
			POSTGRES_PASSWORD: 'agenda',
			POSTGRES_DB: 'agenda_dev'
		},
		ports: [{ host: 5433, container: 5432 }],
		tmpfs: ['/var/lib/postgresql/data'],
		detached: true
	});

	containerStartedByUs = true;
	console.log('✓ PostgreSQL container started');
	return true;
}

async function _startDockerContainer(): Promise<boolean> {
	const runtime = await containerRuntime.getRuntime();

	if (!runtime) {
		return false;
	}

	console.log(`🐳 Starting PostgreSQL container with ${runtime}...`);
	try {
		// Check if container already exists and is running
		if (await containerRuntime.isContainerRunning(CONTAINER_NAME)) {
			console.log('✓ PostgreSQL container is already running');
			return true;
		}

		// Try to start existing container
		try {
			await _startContainer();
			return true;
		} catch {
			// Container doesn't exist, create it
		}

		// Start a new container (using port 5433 to avoid conflicts with system PostgreSQL)
		return await _startNewContainer();
	} catch (error) {
		console.error(`Failed to start container with ${runtime}:`, (error as Error).message);
		return false;
	}
}

async function _waitForPostgres(url: string, maxAttempts = 30): Promise<boolean> {
	for (let i = 0; i < maxAttempts; i++) {
		if (await _isPostgresReady(url)) {
			return true;
		}
		process.stdout.write('.');
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}
	return false;
}

async function _stopDockerContainer(): Promise<void> {
	if (!containerStartedByUs) {
		return;
	}

	const runtime = await containerRuntime.getRuntime();
	console.log(`\n🐳 Stopping PostgreSQL container (${runtime})...`);

	if (!runtime) {
		return;
	}

	try {
		await containerRuntime.stopAndRemoveContainer(CONTAINER_NAME);
		console.log('✓ PostgreSQL container stopped and removed');
	} catch (error) {
		console.error('Failed to stop container:', (error as Error).message);
	}
}


async function _fillWithJobs(agenda: Agenda, count: number): Promise<void> {
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


startDevServer().catch((err) => {
	console.error('Failed to start dev server:', err);
	process.exit(1);
});
