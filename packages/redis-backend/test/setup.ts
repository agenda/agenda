/**
 * Test setup for Redis backend tests
 *
 * This file is automatically loaded by vitest before running tests.
 * It automatically starts a Docker container if no Redis connection is available.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import Redis from 'ioredis';

const execAsync = promisify(exec);

const DEFAULT_TEST_URL = 'redis://localhost:6379';
let containerStartedByUs = false;

async function isRedisReady(url: string): Promise<boolean> {
	const redis = new Redis(url, { connectTimeout: 2000, lazyConnect: true });
	try {
		await redis.connect();
		await redis.ping();
		return true;
	} catch {
		return false;
	} finally {
		redis.disconnect();
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
	console.log('🐳 Starting Redis Docker container...');
	try {
		// Start container with docker compose
		await execAsync('docker compose up -d --wait', {
			cwd: new URL('.', import.meta.url).pathname.replace('/test/', '')
		});
		containerStartedByUs = true;
		console.log('✓ Redis container started');
		return true;
	} catch (error) {
		console.error('Failed to start Docker container:', (error as Error).message);
		return false;
	}
}

async function waitForRedis(url: string, maxAttempts = 30): Promise<boolean> {
	for (let i = 0; i < maxAttempts; i++) {
		if (await isRedisReady(url)) {
			return true;
		}
		await new Promise(resolve => setTimeout(resolve, 1000));
	}
	return false;
}

export async function setup() {
	const testUrl = process.env.REDIS_TEST_URL || DEFAULT_TEST_URL;

	// First, check if Redis is already available
	if (await isRedisReady(testUrl)) {
		console.log('\n✓ Connected to Redis test server\n');
		process.env.REDIS_TEST_URL = testUrl;
		return;
	}

	// Redis not available - try to start Docker container
	console.log('\n⚠️  Redis not available, attempting to start Docker container...');

	if (!(await isDockerAvailable())) {
		throw new Error(
			'Redis is not available and Docker is not installed.\n' +
				'Please either:\n' +
				'  1. Install Docker and run: pnpm docker:up\n' +
				'  2. Set REDIS_TEST_URL to an existing Redis server'
		);
	}

	if (!(await startDockerContainer())) {
		throw new Error(
			'Failed to start Redis Docker container.\n' +
				'Please check Docker is running and try: pnpm docker:up'
		);
	}

	console.log('⏳ Waiting for Redis to be ready...');
	if (await waitForRedis(testUrl)) {
		console.log('✓ Redis is ready\n');
		process.env.REDIS_TEST_URL = testUrl;
		return;
	}

	throw new Error(
		'Redis container started but failed to become ready in time.\n' +
			'Check container logs with: pnpm docker:logs'
	);
}

export async function teardown() {
	// Stop the container if we started it
	if (containerStartedByUs) {
		console.log('\n🐳 Stopping Redis Docker container...');
		try {
			await execAsync('docker compose down', {
				cwd: new URL('.', import.meta.url).pathname.replace('/test/', '')
			});
			console.log('✓ Redis container stopped\n');
		} catch (error) {
			console.error('Failed to stop container:', (error as Error).message);
		}
	}
}
