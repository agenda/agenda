/**
 * Test setup for PostgreSQL backend tests
 *
 * This file is automatically loaded by vitest before running tests.
 * It automatically starts a Docker container if no PostgreSQL connection is available.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { Pool } from 'pg';

const execAsync = promisify(exec);

const DEFAULT_TEST_URL = 'postgresql://agenda:agenda@localhost:5432/agenda_test';
let containerStartedByUs = false;

async function isPostgresReady(url: string): Promise<boolean> {
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

async function isDockerAvailable(): Promise<boolean> {
	try {
		await execAsync('docker --version');
		return true;
	} catch {
		return false;
	}
}

async function startDockerContainer(): Promise<boolean> {
	console.log('🐳 Starting PostgreSQL Docker container...');
	try {
		// Start container with docker compose
		await execAsync('docker compose up -d --wait', {
			cwd: new URL('.', import.meta.url).pathname.replace('/test/', '')
		});
		containerStartedByUs = true;
		console.log('✓ PostgreSQL container started');
		return true;
	} catch (error) {
		console.error('Failed to start Docker container:', (error as Error).message);
		return false;
	}
}

async function waitForPostgres(url: string, maxAttempts = 30): Promise<boolean> {
	for (let i = 0; i < maxAttempts; i++) {
		if (await isPostgresReady(url)) {
			return true;
		}
		await new Promise(resolve => setTimeout(resolve, 1000));
	}
	return false;
}

export async function setup() {
	const testUrl = process.env.POSTGRES_TEST_URL || DEFAULT_TEST_URL;

	// First, check if PostgreSQL is already available
	if (await isPostgresReady(testUrl)) {
		console.log('\n✓ Connected to PostgreSQL test database\n');
		process.env.POSTGRES_TEST_URL = testUrl;
		return;
	}

	// PostgreSQL not available - try to start Docker container
	console.log('\n⚠️  PostgreSQL not available, attempting to start Docker container...');

	if (!(await isDockerAvailable())) {
		throw new Error(
			'PostgreSQL is not available and Docker is not installed.\n' +
				'Please either:\n' +
				'  1. Install Docker and run: pnpm docker:up\n' +
				'  2. Set POSTGRES_TEST_URL to an existing PostgreSQL database'
		);
	}

	if (!(await startDockerContainer())) {
		throw new Error(
			'Failed to start PostgreSQL Docker container.\n' +
				'Please check Docker is running and try: pnpm docker:up'
		);
	}

	console.log('⏳ Waiting for PostgreSQL to be ready...');
	if (await waitForPostgres(testUrl)) {
		console.log('✓ PostgreSQL is ready\n');
		process.env.POSTGRES_TEST_URL = testUrl;
		return;
	}

	throw new Error(
		'PostgreSQL container started but failed to become ready in time.\n' +
			'Check container logs with: pnpm docker:logs'
	);
}

export async function teardown() {
	// Stop the container if we started it
	if (containerStartedByUs) {
		console.log('\n🐳 Stopping PostgreSQL Docker container...');
		try {
			await execAsync('docker compose down', {
				cwd: new URL('.', import.meta.url).pathname.replace('/test/', '')
			});
			console.log('✓ PostgreSQL container stopped\n');
		} catch (error) {
			console.error('Failed to stop container:', (error as Error).message);
		}
	}
}
