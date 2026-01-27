/**
 * Job Debouncing Example
 *
 * This example demonstrates:
 * - Basic trailing debounce (execute after quiet period)
 * - Leading debounce (execute immediately, ignore subsequent)
 * - maxWait option (guarantee execution within max time)
 * - Debounce with unique constraints
 * - Multiple debounced jobs with different keys
 *
 * Run with: npx tsx examples/debounce.ts
 */
import { Agenda } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';

function timestamp(): string {
	return new Date().toISOString().substring(11, 23);
}

async function main() {
	const agenda = new Agenda({
		backend: new MongoBackend({
			address: 'mongodb://127.0.0.1/agenda-examples',
			collection: `debounce-example-${Date.now()}`
		}),
		processEvery: '100ms' // Fast processing for demo
	});

	// Handle errors
	agenda.on('error', err => {
		console.error(`[${timestamp()}] [ERROR] ${err.message}`);
	});

	// ===========================================
	// EXAMPLE 1: Trailing Debounce (Default)
	// Job executes after quiet period ends
	// ===========================================

	let trailingExecutions = 0;
	agenda.define('trailing-debounce-job', async job => {
		trailingExecutions++;
		console.log(
			`[${timestamp()}] [trailing-debounce-job] EXECUTED! ` +
				`Data: ${JSON.stringify(job.attrs.data)}, ` +
				`Total executions: ${trailingExecutions}`
		);
	});

	// ===========================================
	// EXAMPLE 2: Leading Debounce
	// Job executes immediately on first call
	// ===========================================

	let leadingExecutions = 0;
	agenda.define('leading-debounce-job', async job => {
		leadingExecutions++;
		console.log(
			`[${timestamp()}] [leading-debounce-job] EXECUTED! ` +
				`Data: ${JSON.stringify(job.attrs.data)}, ` +
				`Total executions: ${leadingExecutions}`
		);
	});

	// ===========================================
	// EXAMPLE 3: Debounce with maxWait
	// Guarantees execution within maxWait even with continuous saves
	// ===========================================

	let maxWaitExecutions = 0;
	agenda.define('maxwait-debounce-job', async job => {
		maxWaitExecutions++;
		console.log(
			`[${timestamp()}] [maxwait-debounce-job] EXECUTED! ` +
				`Data: ${JSON.stringify(job.attrs.data)}, ` +
				`Total executions: ${maxWaitExecutions}`
		);
	});

	// ===========================================
	// EXAMPLE 4: Multiple Independent Debounced Jobs
	// Different unique keys = independent debounce timers
	// ===========================================

	const entityExecutions: Record<string, number> = {};
	agenda.define('entity-sync-job', async job => {
		const entityId = job.attrs.data?.entityId;
		entityExecutions[entityId] = (entityExecutions[entityId] || 0) + 1;
		console.log(
			`[${timestamp()}] [entity-sync-job] Synced entity ${entityId}! ` +
				`Data: ${JSON.stringify(job.attrs.data)}, ` +
				`Executions for this entity: ${entityExecutions[entityId]}`
		);
	});

	// ===========================================
	// RUN DEMONSTRATION
	// ===========================================

	console.log('='.repeat(60));
	console.log('Job Debouncing Demo');
	console.log('='.repeat(60));
	console.log();

	await agenda.start();

	// Demo 1: Trailing Debounce
	console.log('--- Demo 1: Trailing Debounce (500ms delay) ---');
	console.log('Saving 5 jobs rapidly... only 1 should execute after 500ms quiet period\n');

	for (let i = 1; i <= 5; i++) {
		console.log(`[${timestamp()}] Saving trailing-debounce-job with value: ${i}`);
		await agenda
			.create('trailing-debounce-job', { key: 'trailing-test', value: i })
			.unique({ 'data.key': 'trailing-test' })
			.debounce(500)
			.save();
		await new Promise(resolve => setTimeout(resolve, 100)); // 100ms between saves
	}

	// Wait for execution
	await new Promise(resolve => setTimeout(resolve, 1000));
	console.log();

	// Demo 2: Leading Debounce
	console.log('--- Demo 2: Leading Debounce (2s delay) ---');
	console.log('Saving 3 jobs rapidly... first should execute immediately, rest ignored\n');

	for (let i = 1; i <= 3; i++) {
		console.log(`[${timestamp()}] Saving leading-debounce-job with value: ${i}`);
		await agenda
			.create('leading-debounce-job', { key: 'leading-test', value: i })
			.unique({ 'data.key': 'leading-test' })
			.debounce(2000, { strategy: 'leading' })
			.save();
		await new Promise(resolve => setTimeout(resolve, 200));
	}

	// Wait for processing
	await new Promise(resolve => setTimeout(resolve, 500));
	console.log();

	// Demo 3: Debounce with maxWait
	console.log('--- Demo 3: Debounce with maxWait (delay: 1s, maxWait: 500ms) ---');
	console.log('Saving jobs every 200ms... should execute after maxWait even with continuous saves\n');

	for (let i = 1; i <= 5; i++) {
		console.log(`[${timestamp()}] Saving maxwait-debounce-job with value: ${i}`);
		await agenda
			.create('maxwait-debounce-job', { key: 'maxwait-test', value: i })
			.unique({ 'data.key': 'maxwait-test' })
			.debounce(1000, { maxWait: 500 })
			.save();
		await new Promise(resolve => setTimeout(resolve, 200));
	}

	// Wait for execution
	await new Promise(resolve => setTimeout(resolve, 1500));
	console.log();

	// Demo 4: Multiple Independent Debounced Jobs
	console.log('--- Demo 4: Multiple Independent Debounced Jobs ---');
	console.log('Saving jobs for 3 different entities... each has independent debounce\n');

	for (let entity = 1; entity <= 3; entity++) {
		for (let i = 1; i <= 3; i++) {
			console.log(`[${timestamp()}] Saving entity-sync-job for entity ${entity}, update ${i}`);
			await agenda
				.create('entity-sync-job', { entityId: entity, update: i })
				.unique({ 'data.entityId': entity })
				.debounce(300)
				.save();
		}
	}

	// Wait for all to execute
	await new Promise(resolve => setTimeout(resolve, 1000));
	console.log();

	// Summary
	console.log('='.repeat(60));
	console.log('Summary:');
	console.log(`  Trailing debounce: ${trailingExecutions} execution(s) (expected: 1)`);
	console.log(`  Leading debounce: ${leadingExecutions} execution(s) (expected: 1)`);
	console.log(`  MaxWait debounce: ${maxWaitExecutions} execution(s) (expected: 1-2)`);
	console.log(`  Entity sync: ${Object.keys(entityExecutions).length} entities synced (expected: 3)`);
	console.log('='.repeat(60));

	console.log('\nDemo complete - shutting down');
	await agenda.drain();
	process.exit(0);
}

main().catch(console.error);
