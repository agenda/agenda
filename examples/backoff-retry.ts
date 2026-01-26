/**
 * Automatic Retry with Backoff Strategies Example
 *
 * This example demonstrates:
 * - Built-in backoff strategies (constant, linear, exponential)
 * - Preset strategies (aggressive, standard, relaxed)
 * - Custom backoff functions
 * - Combining strategies with combine()
 * - Conditional retry with when()
 * - Retry events (retry, retry exhausted)
 *
 * Run with: npx tsx examples/backoff-retry.ts
 */
import {
	Agenda,
	backoffStrategies,
	constant,
	linear,
	exponential,
	combine,
	when
} from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';

function timestamp(): string {
	return new Date().toISOString().substring(11, 23);
}

async function main() {
	const agenda = new Agenda({
		backend: new MongoBackend({
			address: 'mongodb://127.0.0.1/agenda-examples',
			collection: `backoff-example-${Date.now()}`
		}),
		processEvery: '100ms' // Fast processing for demo
	});

	// Handle errors
	agenda.on('error', err => {
		console.error(`[${timestamp()}] [ERROR] ${err.message}`);
	});

	// ===========================================
	// RETRY EVENTS
	// ===========================================

	// Listen when any job is scheduled for retry
	agenda.on('retry', (job, details) => {
		console.log(
			`[${timestamp()}] [RETRY] "${job.attrs.name}" attempt #${details.attempt} ` +
				`will retry in ${details.delay}ms`
		);
	});

	// Listen when a job exhausts all retries
	agenda.on('retry exhausted', (error, job) => {
		console.log(
			`[${timestamp()}] [EXHAUSTED] "${job.attrs.name}" gave up after ` +
				`${job.attrs.failCount} attempts: ${error.message}`
		);
	});

	// ===========================================
	// EXAMPLE 1: Constant Backoff
	// Same delay between each retry
	// ===========================================

	agenda.define(
		'constant-backoff-job',
		async job => {
			const attempt = (job.attrs.failCount || 0) + 1;
			console.log(`[${timestamp()}] [constant-backoff-job] Attempt ${attempt}`);

			if (attempt < 3) {
				throw new Error('Simulated failure');
			}
			console.log(`[${timestamp()}] [constant-backoff-job] Success on attempt ${attempt}!`);
		},
		{
			backoff: constant({
				delay: 500, // 500ms between each retry
				maxRetries: 3
			})
		}
	);

	// ===========================================
	// EXAMPLE 2: Linear Backoff
	// Delay increases by a fixed amount each retry
	// ===========================================

	agenda.define(
		'linear-backoff-job',
		async job => {
			const attempt = (job.attrs.failCount || 0) + 1;
			console.log(`[${timestamp()}] [linear-backoff-job] Attempt ${attempt}`);

			if (attempt < 4) {
				throw new Error('Simulated failure');
			}
			console.log(`[${timestamp()}] [linear-backoff-job] Success on attempt ${attempt}!`);
		},
		{
			backoff: linear({
				delay: 200, // Start at 200ms
				increment: 300, // Add 300ms each retry: 200, 500, 800, 1100...
				maxRetries: 4
			})
		}
	);

	// ===========================================
	// EXAMPLE 3: Exponential Backoff
	// Delay doubles (or multiplies by factor) each retry
	// ===========================================

	agenda.define(
		'exponential-backoff-job',
		async job => {
			const attempt = (job.attrs.failCount || 0) + 1;
			console.log(`[${timestamp()}] [exponential-backoff-job] Attempt ${attempt}`);

			if (attempt < 4) {
				throw new Error('Simulated failure');
			}
			console.log(`[${timestamp()}] [exponential-backoff-job] Success on attempt ${attempt}!`);
		},
		{
			backoff: exponential({
				delay: 100, // Start at 100ms
				factor: 2, // Double each time: 100, 200, 400, 800...
				maxRetries: 5,
				jitter: 0.1 // Add 10% randomness to prevent thundering herd
			})
		}
	);

	// ===========================================
	// EXAMPLE 4: Using Preset Strategies
	// ===========================================

	// Aggressive: Fast retries for transient failures
	agenda.define(
		'aggressive-retry-job',
		async job => {
			const attempt = (job.attrs.failCount || 0) + 1;
			console.log(`[${timestamp()}] [aggressive-retry-job] Attempt ${attempt}`);

			if (attempt < 3) {
				throw new Error('Quick failure');
			}
			console.log(`[${timestamp()}] [aggressive-retry-job] Success!`);
		},
		{
			backoff: backoffStrategies.aggressive() // 100ms, 200ms, 400ms
		}
	);

	// ===========================================
	// EXAMPLE 5: Custom Backoff Function
	// Full control over retry logic
	// ===========================================

	agenda.define(
		'custom-backoff-job',
		async job => {
			const attempt = (job.attrs.failCount || 0) + 1;
			console.log(`[${timestamp()}] [custom-backoff-job] Attempt ${attempt}`);

			if (attempt < 4) {
				throw new Error('Custom failure');
			}
			console.log(`[${timestamp()}] [custom-backoff-job] Success!`);
		},
		{
			// Custom Fibonacci-like backoff
			backoff: ctx => {
				if (ctx.attempt > 5) return null; // Stop after 5 attempts
				const fibDelays = [100, 100, 200, 300, 500];
				return fibDelays[ctx.attempt - 1];
			}
		}
	);

	// ===========================================
	// EXAMPLE 6: Combining Strategies
	// Chain multiple strategies together
	// ===========================================

	agenda.define(
		'combined-strategy-job',
		async job => {
			const attempt = (job.attrs.failCount || 0) + 1;
			console.log(`[${timestamp()}] [combined-strategy-job] Attempt ${attempt}`);

			if (attempt < 5) {
				throw new Error('Needs multiple retries');
			}
			console.log(`[${timestamp()}] [combined-strategy-job] Success!`);
		},
		{
			backoff: combine(
				// First 2 retries: quick 100ms delay
				ctx => (ctx.attempt <= 2 ? 100 : null),
				// Retries 3-5: exponential backoff starting at 500ms
				ctx => {
					if (ctx.attempt > 5) return null;
					return 500 * Math.pow(2, ctx.attempt - 3);
				}
			)
		}
	);

	// ===========================================
	// EXAMPLE 7: Conditional Retry (when)
	// Only retry for specific errors
	// ===========================================

	let conditionalAttempt = 0;
	agenda.define(
		'conditional-retry-job',
		async () => {
			conditionalAttempt++;
			console.log(`[${timestamp()}] [conditional-retry-job] Attempt ${conditionalAttempt}`);

			if (conditionalAttempt === 1) {
				// This error WILL trigger retry
				throw new Error('timeout occurred');
			}
			if (conditionalAttempt === 2) {
				// This error will NOT trigger retry (no "timeout" in message)
				throw new Error('validation failed');
			}
			console.log(`[${timestamp()}] [conditional-retry-job] Success!`);
		},
		{
			backoff: when(
				// Only retry if error contains "timeout"
				ctx => ctx.error.message.includes('timeout'),
				constant({ delay: 200, maxRetries: 3 })
			)
		}
	);

	// ===========================================
	// EXAMPLE 8: Job that exhausts retries
	// ===========================================

	agenda.define(
		'always-fails-job',
		async job => {
			const attempt = (job.attrs.failCount || 0) + 1;
			console.log(`[${timestamp()}] [always-fails-job] Attempt ${attempt} - will fail`);
			throw new Error('This job always fails');
		},
		{
			backoff: constant({
				delay: 200,
				maxRetries: 2 // Only 2 retries, then exhausted
			})
		}
	);

	// ===========================================
	// RUN DEMONSTRATION
	// ===========================================

	console.log('='.repeat(60));
	console.log('Automatic Retry with Backoff Strategies Demo');
	console.log('='.repeat(60));
	console.log();

	await agenda.start();

	// Schedule all example jobs
	console.log('Scheduling jobs...\n');

	await agenda.now('constant-backoff-job');
	await agenda.now('linear-backoff-job');
	await agenda.now('exponential-backoff-job');
	await agenda.now('aggressive-retry-job');
	await agenda.now('custom-backoff-job');
	await agenda.now('combined-strategy-job');
	await agenda.now('conditional-retry-job');
	await agenda.now('always-fails-job');

	// Wait for all jobs to complete their retries
	console.log('Processing jobs with automatic retries...\n');

	setTimeout(async () => {
		console.log('\n' + '='.repeat(60));
		console.log('Demo complete - shutting down');
		console.log('='.repeat(60));
		await agenda.drain();
		process.exit(0);
	}, 15000);
}

main().catch(console.error);
