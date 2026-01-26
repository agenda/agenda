/**
 * Basic MongoDB Backend Example
 *
 * This example demonstrates:
 * - Setting up Agenda with MongoDB backend
 * - Defining and scheduling a simple job
 * - Basic event handling
 *
 * Run with: npx tsx examples/basic-mongodb.ts
 *
 * Requirements:
 * - MongoDB running on localhost:27017
 */
import { Agenda, Job } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';

async function main() {
  // Create Agenda with MongoDB backend using connection string
  const agenda = new Agenda({
    backend: new MongoBackend({
      address: 'mongodb://127.0.0.1/agenda-examples'
    })
  });

  // IMPORTANT: Always attach an error handler to prevent unhandled promise rejections
  agenda.on('error', err => {
    console.error('Agenda error:', err);
  });

  // Define a simple job
  agenda.define('say hello', async (job: Job<{ name: string }>) => {
    const { name } = job.attrs.data;
    console.log(`Hello, ${name}!`);
  });

  // Listen for job events
  agenda.on('start', job => {
    console.log(`Job ${job.attrs.name} starting...`);
  });

  agenda.on('success', job => {
    console.log(`Job ${job.attrs.name} completed successfully`);
  });

  // Start the job processor
  await agenda.start();
  console.log('Agenda started');

  // Schedule a job to run immediately
  await agenda.now('say hello', { name: 'World' });
  console.log('Job scheduled');

  // Wait for jobs to process then shutdown
  setTimeout(async () => {
    await agenda.drain();
    console.log('Agenda stopped');
    process.exit(0);
  }, 3000);
}

main().catch(console.error);
