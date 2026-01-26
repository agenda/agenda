/**
 * Graceful Shutdown Example
 *
 * This example demonstrates:
 * - drain() - Wait for running jobs to complete before stopping
 * - stop() - Stop immediately and unlock running jobs
 * - Handling SIGTERM and SIGINT signals
 * - Proper cleanup patterns for production
 *
 * Run with: npx tsx examples/graceful-shutdown.ts
 * Then press Ctrl+C to trigger graceful shutdown
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
      collection: `shutdown-example-${Date.now()}`
    }),
    processEvery: '1 second'
  });

  agenda.on('error', err => console.error('Agenda error:', err));

  // Define a long-running job to demonstrate graceful shutdown
  agenda.define('long running task', async (job: Job<{ taskId: number }>) => {
    const { taskId } = job.attrs.data;
    log(`Task ${taskId}: Started (will take 5 seconds)`);

    // Simulate long-running work
    for (let i = 1; i <= 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      log(`Task ${taskId}: Progress ${i * 20}%`);
    }

    log(`Task ${taskId}: Completed`);
  });

  agenda.define('quick task', async () => {
    log('Quick task executed');
  });

  // Track job lifecycle
  agenda.on('start', job => {
    log(`[EVENT] Job "${job.attrs.name}" started`);
  });

  agenda.on('complete', job => {
    log(`[EVENT] Job "${job.attrs.name}" completed`);
  });

  // ===========================================
  // GRACEFUL SHUTDOWN SETUP
  // ===========================================

  let isShuttingDown = false;

  async function gracefulShutdown(signal: string) {
    if (isShuttingDown) {
      log('Shutdown already in progress...');
      return;
    }
    isShuttingDown = true;

    log(`\n${signal} received. Starting graceful shutdown...`);
    log('Waiting for running jobs to complete...');

    // drain() waits for all running jobs to finish before stopping
    // This is the recommended way to shut down in production
    await agenda.drain();

    log('All jobs completed. Shutdown complete.');
    process.exit(0);
  }

  // Handle shutdown signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // ===========================================
  // ALTERNATIVE: Immediate shutdown with stop()
  // ===========================================

  // If you need to shut down immediately without waiting:
  //
  // async function immediateShutdown() {
  //   log('Stopping immediately...');
  //   // stop() unlocks running jobs so other workers can pick them up
  //   await agenda.stop();
  //   log('Stopped. Running jobs were unlocked.');
  //   process.exit(0);
  // }

  // ===========================================
  // ALTERNATIVE: Shutdown with timeout
  // ===========================================

  // For production, you might want a timeout:
  //
  // async function shutdownWithTimeout(timeoutMs: number) {
  //   const timeout = new Promise<void>((_, reject) => {
  //     setTimeout(() => reject(new Error('Shutdown timeout')), timeoutMs);
  //   });
  //
  //   try {
  //     await Promise.race([agenda.drain(), timeout]);
  //     log('Clean shutdown completed');
  //   } catch (err) {
  //     log('Shutdown timeout reached, forcing stop...');
  //     await agenda.stop();
  //   }
  //   process.exit(0);
  // }

  // ===========================================
  // RUN DEMONSTRATION
  // ===========================================

  await agenda.start();
  log('Agenda started');

  // Schedule some jobs
  await agenda.now('long running task', { taskId: 1 });
  await agenda.now('long running task', { taskId: 2 });
  await agenda.every('2 seconds', 'quick task');

  log('\nPress Ctrl+C to trigger graceful shutdown');
  log('Notice how running jobs complete before shutdown\n');
}

main().catch(console.error);
