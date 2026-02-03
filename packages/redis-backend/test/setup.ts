/**
 * Test setup for Redis backend tests
 *
 * This file is automatically loaded by vitest before running tests.
 * It automatically starts a Docker or Podman container if no Redis connection is available.
 */

import Redis from 'ioredis';
import { containerRuntime } from '../../agenda/src/utils/container-runtime';

const DEFAULT_TEST_URL = 'redis://localhost:6379';
const COMPOSE_CWD = new URL('.', import.meta.url).pathname.replace('/test/', '');

let containerStartedByUs = false;

export async function setup() {
	const testUrl = process.env.REDIS_TEST_URL || DEFAULT_TEST_URL;

	if (await _isRedisReady(testUrl)) {
		console.log('\n✓ Connected to Redis test server\n');
		process.env.REDIS_TEST_URL = testUrl;
		return;
	}

	console.log('\n⚠️  Redis not available, attempting to start container...');

	const { runtime, compose } = await containerRuntime.detect();

	if (!runtime) {
		throw new Error(
			'Redis is not available and no container runtime (Docker or Podman) is installed.\n' +
				'Please either:\n' +
				'  1. Install Docker or Podman\n' +
				'  2. Set REDIS_TEST_URL to an existing Redis server'
		);
	}

	if (!compose) {
		const suggestion = runtime === 'docker'
			? 'the Docker Compose plugin (usually included with Docker Desktop)'
			: 'podman compose (or install Docker as an alternative)';
		throw new Error(
			`${runtime} is installed but compose is not available.\n` +
				`Please install ${suggestion} or set REDIS_TEST_URL to an existing Redis server`
		);
	}

	if (!(await _startContainer())) {
		throw new Error('Failed to start Redis container.\nPlease check your container runtime is working.');
	}

	console.log('⏳ Waiting for Redis to be ready...');
	if (await _waitForRedis(testUrl)) {
		console.log('✓ Redis is ready\n');
		process.env.REDIS_TEST_URL = testUrl;
		return;
	}

	throw new Error(
		'Redis container started but failed to become ready in time.\n' +
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

	console.log('\n🐳 Stopping Redis container...');
	await containerRuntime.stopWithCompose(COMPOSE_CWD);
	console.log('✓ Redis container stopped\n');
}

async function _isRedisReady(url: string): Promise<boolean> {
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

async function _startContainer(): Promise<boolean> {
	const { runtime, compose } = await containerRuntime.detect();

	if (!runtime || !compose) {
		return false;
	}

	console.log(`🐳 Starting Redis container with ${runtime}...`);

	try {
		await containerRuntime.startWithCompose(COMPOSE_CWD);
		containerStartedByUs = true;
		console.log('✓ Redis container started');
		return true;
	} catch (error) {
		console.error('Failed to start container:', (error as Error).message);
		return false;
	}
}

async function _waitForRedis(url: string, maxAttempts = 30): Promise<boolean> {
	for (let i = 0; i < maxAttempts; i++) {
		if (await _isRedisReady(url)) {
			return true;
		}
		await new Promise(resolve => setTimeout(resolve, 1000));
	}
	return false;
}

