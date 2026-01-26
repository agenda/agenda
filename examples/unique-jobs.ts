/**
 * Unique Jobs Example
 *
 * This example demonstrates:
 * - Using unique() to prevent duplicate jobs
 * - Different unique constraint options
 * - Handling idempotent job scheduling
 *
 * Run with: npx tsx examples/unique-jobs.ts
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
      collection: `unique-jobs-example-${Date.now()}`
    }),
    processEvery: '1 second'
  });

  agenda.on('error', err => console.error('Agenda error:', err));

  // Define jobs
  agenda.define('send email', async (job: Job<{ userId: string; emailType: string }>) => {
    const { userId, emailType } = job.attrs.data;
    log(`Sending ${emailType} email to user ${userId}`);
  });

  agenda.define('process order', async (job: Job<{ orderId: string }>) => {
    const { orderId } = job.attrs.data;
    log(`Processing order ${orderId}`);
  });

  agenda.define('sync user', async (job: Job<{ userId: string }>) => {
    const { userId } = job.attrs.data;
    log(`Syncing user ${userId}`);
  });

  await agenda.start();
  log('Agenda started\n');

  // ===========================================
  // Example 1: Unique by specific data field
  // ===========================================
  log('=== Example 1: Unique by data field ===');

  // Schedule welcome email - only one per user
  const email1 = agenda.create('send email', { userId: 'user-123', emailType: 'welcome' });
  email1.unique({ 'data.userId': 'user-123', 'data.emailType': 'welcome' });
  await email1.save();
  log('Scheduled welcome email for user-123');

  // Try to schedule the same email again - this will update, not create duplicate
  const email2 = agenda.create('send email', { userId: 'user-123', emailType: 'welcome' });
  email2.unique({ 'data.userId': 'user-123', 'data.emailType': 'welcome' });
  await email2.save();
  log('Tried to schedule duplicate - existing job was updated\n');

  // Different email type for same user - this WILL create a new job
  const email3 = agenda.create('send email', { userId: 'user-123', emailType: 'reminder' });
  email3.unique({ 'data.userId': 'user-123', 'data.emailType': 'reminder' });
  await email3.save();
  log('Scheduled reminder email for user-123 (different type, new job)\n');

  // ===========================================
  // Example 2: Unique with insertOnly option
  // ===========================================
  log('=== Example 2: Unique with insertOnly ===');

  // With insertOnly: true, if job exists, nothing happens (no update)
  const order1 = agenda.create('process order', { orderId: 'order-456' });
  order1.unique({ 'data.orderId': 'order-456' }, { insertOnly: true });
  await order1.save();
  log('Scheduled order processing for order-456');

  // This won't update the existing job at all
  const order2 = agenda.create('process order', { orderId: 'order-456' });
  order2.unique({ 'data.orderId': 'order-456' }, { insertOnly: true });
  order2.schedule('in 1 hour'); // This schedule change will be ignored
  await order2.save();
  log('Duplicate order-456 ignored (insertOnly: true)\n');

  // ===========================================
  // Example 3: Unique by job name only
  // ===========================================
  log('=== Example 3: Singleton job (unique by name) ===');

  // Create a singleton job - only one instance regardless of data
  const sync1 = agenda.create('sync user', { userId: 'user-A' });
  sync1.unique({ name: 'sync user' }); // Unique by name only
  await sync1.save();
  log('Created sync job for user-A');

  // This will replace the previous job since unique is by name only
  const sync2 = agenda.create('sync user', { userId: 'user-B' });
  sync2.unique({ name: 'sync user' });
  await sync2.save();
  log('Created sync job for user-B (replaced user-A job)\n');

  // ===========================================
  // Query to verify
  // ===========================================
  log('=== Querying jobs to verify ===');
  const result = await agenda.queryJobs({});
  log(`Total jobs in database: ${result.total}`);
  for (const job of result.jobs) {
    log(`  - ${job.name}: ${JSON.stringify(job.data)}`);
  }

  // Cleanup
  setTimeout(async () => {
    await agenda.drain();
    log('\nAgenda stopped');
    process.exit(0);
  }, 5000);
}

main().catch(console.error);
