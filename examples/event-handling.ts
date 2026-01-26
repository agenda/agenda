/**
 * Event Handling Example
 *
 * This example demonstrates:
 * - Agenda lifecycle events (ready, error)
 * - Job lifecycle events (start, success, fail, complete)
 * - Job-specific event handlers (start:jobName, success:jobName, etc.)
 * - Using events for monitoring and logging
 *
 * Run with: npx tsx examples/event-handling.ts
 */
import { Agenda } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';

function timestamp(): string {
  return new Date().toISOString();
}

async function main() {
  const agenda = new Agenda({
    backend: new MongoBackend({
      address: 'mongodb://127.0.0.1/agenda-examples',
      collection: `events-example-${Date.now()}`
    }),
    processEvery: '1 second'
  });

  // ===========================================
  // AGENDA LIFECYCLE EVENTS
  // ===========================================

  // 'ready' - Fired when Agenda has connected to the database
  agenda.on('ready', () => {
    console.log(`[${timestamp()}] [AGENDA] Ready - connected to database`);
  });

  // 'error' - Fired on errors (IMPORTANT: always handle this!)
  agenda.on('error', err => {
    console.error(`[${timestamp()}] [AGENDA] Error:`, err.message);
  });

  // ===========================================
  // GLOBAL JOB EVENTS (all jobs)
  // ===========================================

  // 'start' - Fired when any job starts
  agenda.on('start', job => {
    console.log(`[${timestamp()}] [START] Job "${job.attrs.name}" (ID: ${job.attrs._id})`);
  });

  // 'success' - Fired when any job completes without error
  agenda.on('success', job => {
    console.log(`[${timestamp()}] [SUCCESS] Job "${job.attrs.name}" completed`);
  });

  // 'fail' - Fired when any job throws an error
  agenda.on('fail', (error, job) => {
    console.error(`[${timestamp()}] [FAIL] Job "${job.attrs.name}" failed: ${error.message}`);
  });

  // 'complete' - Fired when any job finishes (success or fail)
  agenda.on('complete', job => {
    const status = job.attrs.failReason ? 'FAILED' : 'SUCCESS';
    console.log(`[${timestamp()}] [COMPLETE] Job "${job.attrs.name}" finished with ${status}`);
  });

  // ===========================================
  // JOB-SPECIFIC EVENTS
  // ===========================================

  // Events specific to a job name: 'start:jobName', 'success:jobName', etc.
  agenda.on('start:important task', _job => {
    console.log(`[${timestamp()}] [IMPORTANT] Starting critical task...`);
  });

  agenda.on('success:important task', _job => {
    console.log(`[${timestamp()}] [IMPORTANT] Critical task completed! Sending notification...`);
    // Here you could send a Slack message, email, etc.
  });

  agenda.on('fail:important task', (_error, _job) => {
    console.error(`[${timestamp()}] [IMPORTANT] ALERT! Critical task failed!`);
    // Here you could page on-call, create incident, etc.
  });

  // ===========================================
  // DEFINE JOBS
  // ===========================================

  agenda.define('successful job', async () => {
    console.log('  -> Doing some work...');
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log('  -> Work completed');
  });

  agenda.define('failing job', async () => {
    console.log('  -> Starting work that will fail...');
    await new Promise(resolve => setTimeout(resolve, 300));
    throw new Error('Something went wrong!');
  });

  agenda.define('important task', async () => {
    console.log('  -> Executing critical business logic...');
    await new Promise(resolve => setTimeout(resolve, 400));
    console.log('  -> Critical task done');
  });

  // ===========================================
  // RUN DEMONSTRATION
  // ===========================================

  console.log('Starting Agenda event handling demo...\n');

  await agenda.start();

  // Schedule various jobs
  await agenda.now('successful job');
  await agenda.now('failing job');
  await agenda.now('important task');

  // Wait for jobs to process, then shutdown
  setTimeout(async () => {
    console.log('\n--- Shutting down ---');
    await agenda.drain();
    console.log('Agenda stopped');
    process.exit(0);
  }, 5000);
}

main().catch(console.error);
