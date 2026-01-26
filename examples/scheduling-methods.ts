/**
 * Scheduling Methods Example
 *
 * This example demonstrates the different ways to schedule jobs:
 * - now() - Run a job immediately
 * - schedule() - Run a job at a specific time
 * - every() - Run a job repeatedly at intervals
 * - create() + save() - Manual job creation with full control
 *
 * Run with: npx tsx examples/scheduling-methods.ts
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
      collection: `scheduling-example-${Date.now()}`
    }),
    processEvery: '1 second'
  });

  agenda.on('error', err => console.error('Agenda error:', err));

  // Define jobs for demonstration
  agenda.define('immediate job', async () => {
    log('Immediate job executed');
  });

  agenda.define('scheduled job', async () => {
    log('Scheduled job executed');
  });

  agenda.define('recurring job', async () => {
    log('Recurring job executed');
  });

  agenda.define('cron job', async () => {
    log('Cron job executed (runs at specific cron schedule)');
  });

  agenda.define('custom job', async (job: Job<{ customField: string }>) => {
    log(`Custom job executed with data: ${job.attrs.data.customField}`);
  });

  // Start Agenda
  await agenda.start();
  log('Agenda started\n');

  // 1. NOW - Run a job immediately
  log('=== agenda.now() - Run immediately ===');
  await agenda.now('immediate job');
  log('Scheduled immediate job\n');

  // 2. SCHEDULE - Run at a specific time
  log('=== agenda.schedule() - Run at specific time ===');

  // Using a Date object
  const inFiveSeconds = new Date(Date.now() + 5000);
  await agenda.schedule(inFiveSeconds, 'scheduled job');
  log(`Scheduled job to run at ${inFiveSeconds.toTimeString().split(' ')[0]}`);

  // Using human-readable string (powered by date.js)
  await agenda.schedule('in 10 seconds', 'scheduled job');
  log('Scheduled job to run "in 10 seconds"\n');

  // 3. EVERY - Run repeatedly at intervals
  log('=== agenda.every() - Run at intervals ===');

  // Human-readable interval
  await agenda.every('3 seconds', 'recurring job');
  log('Scheduled recurring job to run every 3 seconds');

  // Cron expression (runs every minute at second 0)
  await agenda.every('0 * * * * *', 'cron job');
  log('Scheduled cron job with cron expression "0 * * * * *"');

  // With skipImmediate option (don't run immediately, wait for first interval)
  await agenda.every('5 seconds', 'recurring job', undefined, { skipImmediate: true });
  log('Scheduled recurring job with skipImmediate: true\n');

  // 4. CREATE + SAVE - Full manual control
  log('=== agenda.create() + job.save() - Manual control ===');

  // Create a job manually with custom settings
  const job = agenda.create('custom job', { customField: 'manual creation' });
  job.schedule('in 7 seconds');
  job.priority('high');
  await job.save();
  log('Created custom job with priority "high"\n');

  // Run for 20 seconds then shutdown
  log('Running for 20 seconds to demonstrate scheduling...\n');

  setTimeout(async () => {
    log('\n=== Shutting down ===');
    await agenda.drain();
    log('Agenda stopped');
    process.exit(0);
  }, 20000);
}

main().catch(console.error);
