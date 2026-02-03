/**
 * Test setup for PostgreSQL backend tests
 *
 * This file is automatically loaded by vitest before running tests.
 * It automatically starts a Docker or Podman container if no PostgreSQL connection is available.
 */

import { Pool } from 'pg';
import { containerRuntime } from '../../agenda/dist/utils/container-runtime.js';

const DEFAULT_TEST_URL = 'postgresql://agenda:agenda@localhost:5432/agenda_test';
const COMPOSE_CWD = new URL('.', import.meta.url).pathname.replace('/test/', '');

let containerStartedByUs = false;

export async function setup() {
	const testUrl = process.env.POSTGRES_TEST_URL || DEFAULT_TEST_URL;

	if (await _isPostgresReady(testUrl)) {
		console.log('\n✓ Connected to PostgreSQL test database\n');
		process.env.POSTGRES_TEST_URL = testUrl;
		return;
	}

	console.log('\n⚠️  PostgreSQL not available, attempting to start container...');

	const { runtime, compose } = await containerRuntime.detect();

	if (!runtime) {
		throw new Error(
			'PostgreSQL is not available and no container runtime (Docker or Podman) is installed.\n' +
				'Please either:\n' +
				'  1. Install Docker or Podman\n' +
				'  2. Set POSTGRES_TEST_URL to an existing PostgreSQL database'
		);
	}

	if (!compose) {
		const suggestion = runtime === 'docker'
			? 'the Docker Compose plugin (usually included with Docker Desktop)'
			: 'podman compose (or install Docker as an alternative)';
		throw new Error(
			`${runtime} is installed but compose is not available.\n` +
				`Please install ${suggestion} or set POSTGRES_TEST_URL to an existing PostgreSQL database`
		);
	}

	if (!(await _startContainer())) {
		throw new Error('Failed to start PostgreSQL container.\nPlease check your container runtime is working.');
	}

	console.log('⏳ Waiting for PostgreSQL to be ready...');
	if (await _waitForPostgres(testUrl)) {
		console.log('✓ PostgreSQL is ready\n');
		process.env.POSTGRES_TEST_URL = testUrl;
		return;
	}

	throw new Error(
		'PostgreSQL container started but failed to become ready in time.\n' +
			'Check container logs with: docker/podman compose logs'
	);
}

export async function teardown() {
	if (!containerStartedByUs) {
		return;
	}

	const compose = await containerRuntime.getCompose();

	if (!compose) {
		return;
	}

	console.log('\n🐳 Stopping PostgreSQL container...');
	await containerRuntime.stopWithCompose(COMPOSE_CWD);
	console.log('✓ PostgreSQL container stopped\n');
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

async function _startContainer(): Promise<boolean> {
	const { runtime, compose } = await containerRuntime.detect();

	if (!runtime || !compose) {
		return false;
	}

	console.log(`🐳 Starting PostgreSQL container with ${runtime}...`);

	try {
		await containerRuntime.startWithCompose(COMPOSE_CWD);
		containerStartedByUs = true;
		console.log('✓ PostgreSQL container started');
		return true;
	} catch (error) {
		console.error('Failed to start container:', (error as Error).message);
		return false;
	}
}

async function _waitForPostgres(url: string, maxAttempts = 30): Promise<boolean> {
	for (let i = 0; i < maxAttempts; i++) {
		if (await _isPostgresReady(url)) {
			return true;
		}
		await new Promise(resolve => setTimeout(resolve, 1000));
	}
	return false;
}

