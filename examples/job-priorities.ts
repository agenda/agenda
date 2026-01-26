/**
 * Job Priorities Example
 *
 * This example demonstrates:
 * - Setting job priorities (highest, high, normal, low, lowest)
 * - How priority affects job processing order
 * - Priority defined at job definition vs at scheduling time
 *
 * Run with: npx tsx examples/job-priorities.ts
 */
import { Agenda, Job } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';

function log(message: string) {
  console.log(`[${new Date().toTimeString().split(' ')[0]}] ${message}`);
}

async function main() {
  const agenda = new Agenda({
    backend: new MongoBackend({
      address: 'mongodb://127.0.0.1/agenda-examples',
      collection: `priorities-example-${Date.now()}`
    }),
    processEvery: '500 milliseconds',
    // Set low concurrency so we can observe priority ordering
    maxConcurrency: 1,
    defaultConcurrency: 1
  });

  agenda.on('error', err => console.error('Agenda error:', err));

  // Define jobs with different default priorities
  agenda.define(
    'high priority task',
    { priority: 'high' },
    async () => {
      log('HIGH priority task executed');
    }
  );

  agenda.define(
    'low priority task',
    { priority: 'low' },
    async () => {
      log('LOW priority task executed');
    }
  );

  agenda.define(
    'normal task',
    async () => {
      log('NORMAL priority task executed');
    }
  );

  agenda.define(
    'configurable task',
    async (job: Job<{ level: string }>) => {
      log(`Task with level "${job.attrs.data.level}" executed (priority: ${job.attrs.priority})`);
    }
  );

  // Track execution order
  const executionOrder: string[] = [];
  agenda.on('complete', job => {
    executionOrder.push(job.attrs.name);
  });

  // Schedule all jobs at the same time before starting
  // This ensures they're all queued and priority determines execution order
  log('Scheduling jobs with different priorities...\n');

  // Schedule low priority jobs first (they should still run last)
  for (let i = 0; i < 3; i++) {
    await agenda.now('low priority task');
  }

  // Schedule normal priority jobs
  for (let i = 0; i < 3; i++) {
    await agenda.now('normal task');
  }

  // Schedule high priority jobs last (they should still run first)
  for (let i = 0; i < 3; i++) {
    await agenda.now('high priority task');
  }

  // Override priority at schedule time using create()
  const urgentJob = agenda.create('configurable task', { level: 'URGENT' });
  urgentJob.priority('highest');
  await urgentJob.save();

  const routineJob = agenda.create('configurable task', { level: 'routine' });
  routineJob.priority('lowest');
  await routineJob.save();

  log('All jobs scheduled. Starting Agenda...\n');
  log('Expected order: URGENT (highest) -> high -> normal -> low -> routine (lowest)\n');

  // Start processing
  await agenda.start();

  // Wait for all jobs to complete
  setTimeout(async () => {
    log('\n=== Execution Summary ===');
    log(`Jobs executed in order: ${executionOrder.join(' -> ')}`);

    await agenda.drain();
    log('Agenda stopped');
    process.exit(0);
  }, 10000);
}

main().catch(console.error);
