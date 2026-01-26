/**
 * Basic Redis Backend Example
 *
 * This example demonstrates:
 * - Setting up Agenda with Redis backend
 * - Using Redis Pub/Sub for real-time job processing
 * - Atomic job locking with Redis WATCH/MULTI/EXEC
 *
 * Run with: npx tsx examples/basic-redis.ts
 *
 * Requirements:
 * - Redis running on localhost:6379
 */
import { Agenda, Job } from 'agenda';
import { RedisBackend } from '@agendajs/redis-backend';

async function main() {
  // Create Agenda with Redis backend
  // RedisBackend provides both storage AND real-time notifications via Pub/Sub
  const agenda = new Agenda({
    backend: new RedisBackend({
      connectionString: 'redis://localhost:6379',
      keyPrefix: 'agenda-examples:' // Optional: customize key prefix
    })
  });

  // IMPORTANT: Always attach an error handler
  agenda.on('error', err => {
    console.error('Agenda error:', err);
  });

  // Define a job
  agenda.define('send notification', async (job: Job<{ userId: string; message: string }>) => {
    const { userId, message } = job.attrs.data;
    console.log(`Sending to user ${userId}: "${message}"`);
  });

  // Listen for job events
  agenda.on('start', job => {
    console.log(`[${new Date().toISOString()}] Job ${job.attrs.name} starting`);
  });

  agenda.on('success', job => {
    console.log(`[${new Date().toISOString()}] Job ${job.attrs.name} succeeded`);
  });

  // Start the processor
  await agenda.start();
  console.log('Agenda started with Redis backend');

  // Schedule jobs
  await agenda.now('send notification', {
    userId: 'user-1',
    message: 'Welcome to Agenda!'
  });

  await agenda.now('send notification', {
    userId: 'user-2',
    message: 'Your report is ready'
  });

  console.log('Jobs scheduled');

  // Graceful shutdown
  setTimeout(async () => {
    await agenda.drain();
    console.log('Agenda stopped');
    process.exit(0);
  }, 5000);
}

main().catch(console.error);
