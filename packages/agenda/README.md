# Agenda

<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/agenda/agenda@main/agenda.svg" alt="Agenda" width="100" height="100">
</p>

<p align="center">
  A light-weight job scheduling library for Node.js
</p>

[![NPM Version](https://img.shields.io/npm/v/agenda.svg)](https://www.npmjs.com/package/agenda)
[![NPM Downloads](https://img.shields.io/npm/dm/agenda.svg)](https://www.npmjs.com/package/agenda)

> **Migrating from v5?** See the [Migration Guide](https://github.com/agenda/agenda/blob/main/docs/migration-guide-v6.md) for all breaking changes.

## Agenda 6.x

Agenda 6.x is a complete TypeScript rewrite with a focus on **modularity** and **flexibility**:

- **Pluggable storage backends** - Choose from MongoDB, PostgreSQL, Redis, or implement your own. Each backend is a separate package - install only what you need.

- **Pluggable notification channels** - Move beyond polling with real-time job notifications via Redis, PostgreSQL LISTEN/NOTIFY, or other pub/sub systems. Jobs get processed immediately when saved, not on the next poll cycle.

- **Modern stack** - ESM-only, Node.js 18+, full TypeScript with strict typing.

See the [6.x Roadmap](https://github.com/agenda/agenda/issues/1610) for details and progress.

## Features

- Minimal overhead job scheduling
- Pluggable storage backends (MongoDB, PostgreSQL, Redis)
- TypeScript support with full typing
- Scheduling via cron or human-readable syntax
- Configurable concurrency and locking
- Real-time job notifications (optional)
- Sandboxed worker execution via fork mode
- TypeScript decorators for class-based job definitions

## Installation

Install the core package and your preferred backend:

```bash
# For MongoDB
npm install agenda @agendajs/mongo-backend

# For PostgreSQL
npm install agenda @agendajs/postgres-backend

# For Redis
npm install agenda @agendajs/redis-backend
```

**Requirements:**
- Node.js 18+
- Database of your choice (MongoDB 4+, PostgreSQL, or Redis)

## Quick Start

```javascript
import { Agenda } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';

const agenda = new Agenda({
  backend: new MongoBackend({ address: 'mongodb://localhost/agenda' })
});

// Define a job
agenda.define('send email', async (job) => {
  const { to, subject } = job.attrs.data;
  await sendEmail(to, subject);
});

// Start processing
await agenda.start();

// Schedule jobs
await agenda.every('1 hour', 'send email', { to: 'user@example.com', subject: 'Hello' });
await agenda.schedule('in 5 minutes', 'send email', { to: 'admin@example.com', subject: 'Report' });
await agenda.now('send email', { to: 'support@example.com', subject: 'Urgent' });
```

## Official Backend Packages

| Package | Backend | Notifications | Install |
|---------|---------|---------------|---------|
| [`@agendajs/mongo-backend`](https://www.npmjs.com/package/@agendajs/mongo-backend) | MongoDB | Polling only | `npm install @agendajs/mongo-backend` |
| [`@agendajs/postgres-backend`](https://www.npmjs.com/package/@agendajs/postgres-backend) | PostgreSQL | LISTEN/NOTIFY | `npm install @agendajs/postgres-backend` |
| [`@agendajs/redis-backend`](https://www.npmjs.com/package/@agendajs/redis-backend) | Redis | Pub/Sub | `npm install @agendajs/redis-backend` |

### Backend Capabilities

| Backend | Storage | Notifications | Notes |
|---------|:-------:|:-------------:|-------|
| **MongoDB** (`MongoBackend`) | ✅ | ❌ | Storage only. Combine with external notification channel for real-time. |
| **PostgreSQL** (`PostgresBackend`) | ✅ | ✅ | Full backend. Uses LISTEN/NOTIFY for notifications. |
| **Redis** (`RedisBackend`) | ✅ | ✅ | Full backend. Uses Pub/Sub for notifications. |
| **InMemoryNotificationChannel** | ❌ | ✅ | Notifications only. For single-process/testing. |

## Backend Configuration

### MongoDB

```javascript
import { Agenda } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';

// Via connection string
const agenda = new Agenda({
  backend: new MongoBackend({ address: 'mongodb://localhost/agenda' })
});

// Via existing MongoDB connection
const agenda = new Agenda({
  backend: new MongoBackend({ mongo: existingDb })
});

// With options
const agenda = new Agenda({
  backend: new MongoBackend({
    mongo: db,
    collection: 'jobs'        // Collection name (default: 'agendaJobs')
  }),
  processEvery: '30 seconds', // Job polling interval
  maxConcurrency: 20,         // Max concurrent jobs
  defaultConcurrency: 5       // Default per job type
});
```

### PostgreSQL

```javascript
import { Agenda } from 'agenda';
import { PostgresBackend } from '@agendajs/postgres-backend';

const agenda = new Agenda({
  backend: new PostgresBackend({
    connectionString: 'postgresql://user:pass@localhost:5432/mydb'
  })
});
```

### Redis

```javascript
import { Agenda } from 'agenda';
import { RedisBackend } from '@agendajs/redis-backend';

const agenda = new Agenda({
  backend: new RedisBackend({
    connectionString: 'redis://localhost:6379'
  })
});
```

## Real-Time Notifications

For faster job processing across distributed systems:

```javascript
import { Agenda, InMemoryNotificationChannel } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';

const agenda = new Agenda({
  backend: new MongoBackend({ mongo: db }),
  notificationChannel: new InMemoryNotificationChannel()
});
```

### Mixing Storage and Notification Backends

You can use MongoDB for storage while using a different system for real-time notifications:

```javascript
import { Agenda } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';
import { RedisBackend } from '@agendajs/redis-backend';

// MongoDB for storage + Redis for real-time notifications
const redisBackend = new RedisBackend({ connectionString: 'redis://localhost:6379' });
const agenda = new Agenda({
  backend: new MongoBackend({ mongo: db }),
  notificationChannel: redisBackend.notificationChannel
});
```

This is useful when you want MongoDB's proven durability and flexible queries for job storage, but need faster real-time notifications across multiple processes.

## API Overview

### Defining Jobs

```javascript
// Simple async handler
agenda.define('my-job', async (job) => {
  console.log('Processing:', job.attrs.data);
});

// With options
agenda.define('my-job', async (job) => { /* ... */ }, {
  concurrency: 10,
  lockLimit: 5,
  lockLifetime: 10 * 60 * 1000, // 10 minutes
  priority: 'high'
});
```

### Defining Jobs with Decorators

For a class-based approach, use TypeScript decorators:

```typescript
import { JobsController, Define, Every, registerJobs, Job } from 'agenda';

@JobsController({ namespace: 'email' })
class EmailJobs {
  @Define({ concurrency: 5 })
  async sendWelcome(job: Job<{ userId: string }>) {
    console.log('Sending welcome to:', job.attrs.data.userId);
  }

  @Every('1 hour')
  async cleanupBounced(job: Job) {
    console.log('Cleaning up bounced emails');
  }
}

registerJobs(agenda, [new EmailJobs()]);
await agenda.start();

// Schedule using namespaced name
await agenda.now('email.sendWelcome', { userId: '123' });
```

See [Decorators Documentation](./docs/decorators.md) for full details.

### Scheduling Jobs

```javascript
// Run immediately
await agenda.now('my-job', { userId: '123' });

// Run at specific time
await agenda.schedule('tomorrow at noon', 'my-job', data);
await agenda.schedule(new Date('2024-12-25'), 'my-job', data);

// Run repeatedly
await agenda.every('5 minutes', 'my-job');
await agenda.every('0 * * * *', 'my-job'); // Cron syntax
```

### Job Control

```javascript
// Cancel jobs (removes from database)
await agenda.cancel({ name: 'my-job' });

// Disable/enable jobs globally (by query)
await agenda.disable({ name: 'my-job' });  // Disable all jobs matching query
await agenda.enable({ name: 'my-job' });   // Enable all jobs matching query

// Disable/enable individual jobs
const job = await agenda.create('my-job', data);
job.disable();
await job.save();

// Progress tracking
agenda.define('long-job', async (job) => {
  for (let i = 0; i <= 100; i += 10) {
    await doWork();
    await job.touch(i); // Report progress 0-100
  }
});
```

### Stopping / Draining

```javascript
// Stop immediately - unlocks running jobs so other workers can pick them up
await agenda.stop();

// Drain - waits for running jobs to complete before stopping
await agenda.drain();

// Drain with timeout (30 seconds) - for cloud platforms with shutdown deadlines
const result = await agenda.drain(30000);
if (result.timedOut) {
    console.log(`${result.running} jobs still running after timeout`);
}

// Drain with AbortSignal - for external control
const controller = new AbortController();
setTimeout(() => controller.abort(), 30000);
await agenda.drain({ signal: controller.signal });
```

Use `drain()` for graceful shutdowns where you want in-progress jobs to finish their work.

### Events

```javascript
agenda.on('start', (job) => console.log('Job started:', job.attrs.name));
agenda.on('complete', (job) => console.log('Job completed:', job.attrs.name));
agenda.on('success', (job) => console.log('Job succeeded:', job.attrs.name));
agenda.on('fail', (err, job) => console.log('Job failed:', job.attrs.name, err));

// Job-specific events
agenda.on('start:send email', (job) => { /* ... */ });
agenda.on('fail:send email', (err, job) => { /* ... */ });
```

## Custom Backend

For databases other than MongoDB, PostgreSQL, or Redis, implement `IAgendaBackend`:

```javascript
import { IAgendaBackend, IJobRepository } from 'agenda';

class SQLiteBackend implements IAgendaBackend {
  readonly repository: IJobRepository;
  readonly notificationChannel = undefined; // Or implement INotificationChannel

  async connect() { /* ... */ }
  async disconnect() { /* ... */ }
}

const agenda = new Agenda({
  backend: new SQLiteBackend({ path: './jobs.db' })
});
```

See [Custom Backend Driver](https://github.com/agenda/agenda/blob/main/docs/custom-database-driver.md) for details.

## Documentation

- [Full Documentation](https://github.com/agenda/agenda#readme)
- [Migration Guide (v5 to v6)](https://github.com/agenda/agenda/blob/main/docs/migration-guide-v6.md)
- [Custom Backend Driver](https://github.com/agenda/agenda/blob/main/docs/custom-database-driver.md)
- [TypeScript Decorators](./docs/decorators.md)
- [API Reference](https://agenda.github.io/agenda/)

## Related Packages

**Official Backend Packages:**
- [@agendajs/mongo-backend](https://www.npmjs.com/package/@agendajs/mongo-backend) - MongoDB backend
- [@agendajs/postgres-backend](https://www.npmjs.com/package/@agendajs/postgres-backend) - PostgreSQL backend with LISTEN/NOTIFY
- [@agendajs/redis-backend](https://www.npmjs.com/package/@agendajs/redis-backend) - Redis backend with Pub/Sub

**Tools:**
- [agendash](https://www.npmjs.com/package/agendash) - Web dashboard for Agenda
- [agenda-rest](https://www.npmjs.com/package/agenda-rest) - REST API for Agenda

## License

MIT
