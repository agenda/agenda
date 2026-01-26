/**
 * Basic PostgreSQL Backend Example
 *
 * This example demonstrates:
 * - Setting up Agenda with PostgreSQL backend
 * - Using PostgreSQL's LISTEN/NOTIFY for real-time job processing
 * - Automatic schema creation
 *
 * Run with: npx tsx examples/basic-postgres.ts
 *
 * Requirements:
 * - PostgreSQL running on localhost:5432
 * - Database 'agenda_examples' created
 */
import { Agenda, Job } from 'agenda';
import { PostgresBackend } from '@agendajs/postgres-backend';

async function main() {
  // Create Agenda with PostgreSQL backend
  // PostgresBackend provides both storage AND real-time notifications via LISTEN/NOTIFY
  const agenda = new Agenda({
    backend: new PostgresBackend({
      connectionString: 'postgres://localhost:5432/agenda_examples'
    })
  });

  // IMPORTANT: Always attach an error handler
  agenda.on('error', err => {
    console.error('Agenda error:', err);
  });

  // Define a job
  agenda.define('process data', async (job: Job<{ dataId: string }>) => {
    const { dataId } = job.attrs.data;
    console.log(`Processing data ID: ${dataId}`);
    // Simulate async work
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log(`Finished processing data ID: ${dataId}`);
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
  console.log('Agenda started with PostgreSQL backend');

  // Schedule jobs
  await agenda.now('process data', { dataId: 'abc-123' });
  await agenda.now('process data', { dataId: 'def-456' });
  console.log('Jobs scheduled');

  // Graceful shutdown after jobs complete
  setTimeout(async () => {
    await agenda.drain();
    console.log('Agenda stopped');
    process.exit(0);
  }, 5000);
}

main().catch(console.error);
