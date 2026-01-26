/**
 * Concurrency and Locking Example
 *
 * This example demonstrates:
 * - Job concurrency control (limiting parallel job instances)
 * - Lock lifetime management
 * - Using touch() to extend lock for long-running jobs
 *
 * Run with: npx tsx examples/concurrency.ts
 */
import { Agenda, Job } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';

function time(): string {
  return new Date().toTimeString().split(' ')[0];
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Create agenda with MongoDB backend
const agenda = new Agenda({
  backend: new MongoBackend({
    address: 'mongodb://127.0.0.1/agenda-examples',
    collection: `concurrency-example-${Date.now()}` // Fresh collection each run
  }),
  processEvery: '1 second'
});

// IMPORTANT: Always attach an error handler
agenda.on('error', err => {
  console.error(`${time()} [ERROR]`, err);
});

let jobRunCount = 1;

// Define a job with concurrency and lock settings
agenda.define(
  'long-running job',
  {
    lockLifetime: 5 * 1000, // Max 5 seconds before lock expires
    concurrency: 3 // Allow up to 3 instances to run simultaneously
  },
  async (job: Job) => {
    const thisJob = jobRunCount++;
    console.log(`${time()} Job #${thisJob} started`);

    // Simulate work - 3 jobs will run in parallel due to concurrency: 3
    await sleep(3 * 1000);

    console.log(`${time()} Job #${thisJob} finished`);
  }
);

// Define a job that uses touch() for long-running work
agenda.define(
  'long-running with touch',
  {
    lockLifetime: 5 * 1000, // Lock expires after 5 seconds
    concurrency: 1
  },
  async (job: Job) => {
    console.log(`${time()} Long job started (will use touch to extend lock)`);

    // First chunk of work (4 seconds < 5 second lock lifetime)
    await sleep(4 * 1000);

    // Extend the lock by calling touch() - prevents job from being picked up by another worker
    await job.touch();
    console.log(`${time()} Called touch() to extend lock`);

    // Second chunk of work
    await sleep(4 * 1000);

    console.log(`${time()} Long job finished after 8 seconds total`);
  }
);

// Log job lifecycle events
agenda.on('start', (job) => {
  console.log(`${time()} [EVENT] Job <${job.attrs.name}> starting`);
});

agenda.on('success', (job) => {
  console.log(`${time()} [EVENT] Job <${job.attrs.name}> succeeded`);
});

agenda.on('fail', (error, job) => {
  console.log(`${time()} [EVENT] Job <${job.attrs.name}> failed:`, error.message);
});

// Main execution
async function main() {
  console.log(`${time()} Starting Agenda...`);

  await agenda.start();

  // Schedule the concurrent job to run every second
  await agenda.every('1 second', 'long-running job');

  // Schedule the touch example to run once
  await agenda.now('long-running with touch');

  console.log(`${time()} Jobs scheduled. Press Ctrl+C to stop.`);

  // Graceful shutdown on SIGINT
  process.on('SIGINT', async () => {
    console.log(`\n${time()} Shutting down gracefully...`);
    await agenda.drain();
    console.log(`${time()} All jobs completed. Goodbye!`);
    process.exit(0);
  });
}

main().catch(console.error);
