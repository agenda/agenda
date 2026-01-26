# Agenda Examples

This directory contains working examples demonstrating various Agenda features.

## Running Examples

All examples are written in TypeScript and can be run with `tsx`:

```bash
# From the repository root
npx tsx examples/<example-name>.ts
```

## Prerequisites

Depending on the example, you'll need one of these databases running:

- **MongoDB**: `mongodb://127.0.0.1:27017`
- **PostgreSQL**: `postgres://localhost:5432/agenda_examples`
- **Redis**: `redis://localhost:6379`

## Examples

### Backend Examples

| File | Description |
|------|-------------|
| [basic-mongodb.ts](./basic-mongodb.ts) | Getting started with MongoDB backend |
| [basic-postgres.ts](./basic-postgres.ts) | Getting started with PostgreSQL backend (includes LISTEN/NOTIFY) |
| [basic-redis.ts](./basic-redis.ts) | Getting started with Redis backend (includes Pub/Sub) |

### Core Features

| File | Description |
|------|-------------|
| [scheduling-methods.ts](./scheduling-methods.ts) | Different ways to schedule jobs: `now()`, `schedule()`, `every()`, `create()` |
| [job-priorities.ts](./job-priorities.ts) | Setting and using job priorities (highest to lowest) |
| [concurrency.ts](./concurrency.ts) | Concurrency control and lock management with `touch()` |
| [event-handling.ts](./event-handling.ts) | Listening to job lifecycle events (start, success, fail, complete) |
| [graceful-shutdown.ts](./graceful-shutdown.ts) | Proper shutdown with `drain()` and signal handling |
| [unique-jobs.ts](./unique-jobs.ts) | Preventing duplicate jobs with `unique()` |
| [job-data-types.ts](./job-data-types.ts) | TypeScript generics for type-safe job data |

## Quick Start

Here's the simplest possible Agenda setup:

```typescript
import { Agenda } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';

const agenda = new Agenda({
  backend: new MongoBackend({
    address: 'mongodb://127.0.0.1/agenda'
  })
});

// Always attach an error handler
agenda.on('error', err => console.error(err));

// Define a job
agenda.define('my job', async job => {
  console.log('Job running!', job.attrs.data);
});

// Start processing and schedule a job
await agenda.start();
await agenda.now('my job', { hello: 'world' });
```

## Common Patterns

### Scheduling Jobs

```typescript
// Run immediately
await agenda.now('jobName', { data: 'here' });

// Run at specific time
await agenda.schedule('in 5 minutes', 'jobName');
await agenda.schedule(new Date('2024-12-31'), 'jobName');

// Run repeatedly
await agenda.every('5 minutes', 'jobName');
await agenda.every('0 * * * *', 'jobName');  // Cron: every hour
```

### Job Configuration

```typescript
// Define with options
agenda.define('myJob', {
  concurrency: 5,       // Max parallel instances
  lockLifetime: 60000,  // Lock timeout (ms)
  priority: 'high'      // Priority level
}, async job => { ... });

// Configure at schedule time
const job = agenda.create('myJob', { data: 'here' });
job.priority('high');
job.schedule('in 1 hour');
job.unique({ 'data.userId': '123' });
await job.save();
```

### Graceful Shutdown

```typescript
process.on('SIGTERM', async () => {
  // Wait for running jobs to complete
  await agenda.drain();
  process.exit(0);
});
```

## Tips

1. **Always handle errors**: Attach an `error` event handler to prevent unhandled promise rejections
2. **Use `drain()` for shutdown**: This ensures running jobs complete before stopping
3. **Set appropriate `lockLifetime`**: Match it to your job's expected duration
4. **Use `touch()` for long jobs**: Prevents lock expiration during long-running tasks
5. **Type your job data**: Use TypeScript generics for better IDE support and type safety
