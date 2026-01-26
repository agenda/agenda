/**
 * Typed Job Data Example
 *
 * This example demonstrates:
 * - Using TypeScript generics for type-safe job data
 * - Defining interfaces for job payloads
 * - Accessing typed data within job handlers
 *
 * Run with: npx tsx examples/job-data-types.ts
 */
import { Agenda, Job } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';

function log(message: string) {
  console.log(`[${new Date().toTimeString().split(' ')[0]}] ${message}`);
}

// ===========================================
// Define typed interfaces for job data
// ===========================================

interface EmailJobData {
  to: string;
  subject: string;
  body: string;
  attachments?: string[];
}

interface OrderJobData {
  orderId: string;
  userId: string;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  shippingAddress: {
    street: string;
    city: string;
    zipCode: string;
    country: string;
  };
}

interface ReportJobData {
  reportType: 'daily' | 'weekly' | 'monthly';
  startDate: string;
  endDate: string;
  recipients: string[];
}

async function main() {
  const agenda = new Agenda({
    backend: new MongoBackend({
      address: 'mongodb://127.0.0.1/agenda-examples',
      collection: `typed-jobs-example-${Date.now()}`
    }),
    processEvery: '1 second'
  });

  agenda.on('error', err => console.error('Agenda error:', err));

  // ===========================================
  // Define jobs with typed data
  // ===========================================

  // Email job with typed data
  agenda.define<EmailJobData>('send email', async (job: Job<EmailJobData>) => {
    // job.attrs.data is fully typed as EmailJobData
    const { to, subject, body, attachments } = job.attrs.data;

    log(`Sending email to: ${to}`);
    log(`  Subject: ${subject}`);
    log(`  Body: ${body.substring(0, 50)}...`);
    if (attachments && attachments.length > 0) {
      log(`  Attachments: ${attachments.join(', ')}`);
    }

    // Simulate sending
    await new Promise(resolve => setTimeout(resolve, 100));
    log('  Email sent!');
  });

  // Order processing with complex nested data
  agenda.define<OrderJobData>('process order', async (job: Job<OrderJobData>) => {
    const { orderId, userId, items, shippingAddress } = job.attrs.data;

    log(`Processing order ${orderId} for user ${userId}`);

    // Calculate total (TypeScript knows items is an array with typed elements)
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    log(`  Total items: ${items.length}, Total amount: $${total.toFixed(2)}`);

    // Access nested shipping data (fully typed)
    log(`  Shipping to: ${shippingAddress.city}, ${shippingAddress.country}`);

    await new Promise(resolve => setTimeout(resolve, 100));
    log('  Order processed!');
  });

  // Report generation with union types
  agenda.define<ReportJobData>('generate report', async (job: Job<ReportJobData>) => {
    const { reportType, startDate, endDate, recipients } = job.attrs.data;

    log(`Generating ${reportType} report`);
    log(`  Period: ${startDate} to ${endDate}`);
    log(`  Recipients: ${recipients.join(', ')}`);

    await new Promise(resolve => setTimeout(resolve, 100));
    log('  Report generated!');
  });

  // ===========================================
  // Schedule typed jobs
  // ===========================================

  await agenda.start();
  log('Agenda started\n');

  // Schedule email job with type-safe data
  await agenda.now<EmailJobData>('send email', {
    to: 'user@example.com',
    subject: 'Welcome to our platform!',
    body: 'Thank you for signing up. We are excited to have you on board...',
    attachments: ['welcome-guide.pdf']
  });

  // Schedule order processing
  await agenda.now<OrderJobData>('process order', {
    orderId: 'ORD-12345',
    userId: 'USR-789',
    items: [
      { productId: 'PROD-001', quantity: 2, price: 29.99 },
      { productId: 'PROD-002', quantity: 1, price: 49.99 }
    ],
    shippingAddress: {
      street: '123 Main St',
      city: 'San Francisco',
      zipCode: '94102',
      country: 'USA'
    }
  });

  // Schedule report generation
  await agenda.schedule<ReportJobData>('in 2 seconds', 'generate report', {
    reportType: 'weekly',
    startDate: '2024-01-01',
    endDate: '2024-01-07',
    recipients: ['manager@company.com', 'analyst@company.com']
  });

  log('All typed jobs scheduled\n');

  // ===========================================
  // Create job manually with typed data
  // ===========================================

  // Using create() also supports generics
  const emailJob = agenda.create<EmailJobData>('send email', {
    to: 'admin@example.com',
    subject: 'System Alert',
    body: 'This is an important system notification...'
  });
  emailJob.schedule('in 3 seconds');
  emailJob.priority('high');
  await emailJob.save();

  log('Scheduled high-priority email\n');

  // Cleanup
  setTimeout(async () => {
    await agenda.drain();
    log('Agenda stopped');
    process.exit(0);
  }, 6000);
}

main().catch(console.error);
