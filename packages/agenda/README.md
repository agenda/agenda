# Agenda

<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/agenda/agenda@master/agenda.svg" alt="Agenda" width="100" height="100">
</p>

<p align="center">
  A light-weight job scheduling library for Node.js
</p>

[![NPM Version](https://img.shields.io/npm/v/agenda.svg)](https://www.npmjs.com/package/agenda)
[![NPM Downloads](https://img.shields.io/npm/dm/agenda.svg)](https://www.npmjs.com/package/agenda)

> **Migrating from v5?** See the [Migration Guide](https://github.com/agenda/agenda/blob/main/docs/migration-guide-v6.md) for all breaking changes.

## Agenda 6.x

Agenda 6.x is a complete TypeScript rewrite with a focus on **modularity** and **flexibility**:

- **Pluggable storage backends** - MongoDB ships built-in, but the new `IAgendaBackend` interface allows using PostgreSQL, SQLite, or any database. Bring your own driver or use community packages.

- **Pluggable notification channels** - Move beyond polling with real-time job notifications via Redis, PostgreSQL LISTEN/NOTIFY, or other pub/sub systems. Jobs get processed immediately when saved, not on the next poll cycle.

- **Modern stack** - ESM-only, Node.js 18+, MongoDB driver v6, full TypeScript with strict typing.

See the [6.x Roadmap](https://github.com/agenda/agenda/issues/1610) for details and progress.

## Features

- Minimal overhead job scheduling
- MongoDB-backed persistence (with pluggable backends)
- TypeScript support with full typing
- Scheduling via cron or human-readable syntax
- Configurable concurrency and locking
- Real-time job notifications (optional)
- Sandboxed worker execution via fork mode

## Installation

```bash
npm install agenda
```

**Requirements:**
- Node.js 18+
- MongoDB 4+ (or custom backend)

## Quick Start

```javascript
import { Agenda, MongoBackend } from 'agenda';

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

## Backend Configuration

```javascript
import { Agenda, MongoBackend } from 'agenda';

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
    collection: 'jobs',      // Collection name (default: 'agendaJobs')
    ensureIndex: true         // Create indexes on start
  }),
  processEvery: '30 seconds', // Job polling interval
  maxConcurrency: 20,         // Max concurrent jobs
  defaultConcurrency: 5       // Default per job type
});
```

## Real-Time Notifications

For faster job processing across distributed systems:

```javascript
import { Agenda, MongoBackend, InMemoryNotificationChannel } from 'agenda';

const agenda = new Agenda({
  backend: new MongoBackend({ mongo: db }),
  notificationChannel: new InMemoryNotificationChannel()
});
```

For production, implement a Redis or other pub/sub channel. See [documentation](https://github.com/agenda/agenda#real-time-notifications).

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
// Cancel jobs
await agenda.cancel({ name: 'my-job' });

// Disable/enable
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

Implement `IAgendaBackend` to use a different database:

```javascript
import { IAgendaBackend, IJobRepository } from 'agenda';

class PostgresBackend implements IAgendaBackend {
  readonly repository: IJobRepository;
  readonly notificationChannel = undefined; // Or implement INotificationChannel

  async connect() { /* ... */ }
  async disconnect() { /* ... */ }
}

const agenda = new Agenda({
  backend: new PostgresBackend({ connectionString: 'postgres://...' })
});
```

See [Custom Backend Driver](https://github.com/agenda/agenda/blob/main/docs/custom-database-driver.md) for details.

## Documentation

- [Full Documentation](https://github.com/agenda/agenda#readme)
- [Migration Guide (v5 to v6)](https://github.com/agenda/agenda/blob/main/docs/migration-guide-v6.md)
- [Custom Backend Driver](https://github.com/agenda/agenda/blob/main/docs/custom-database-driver.md)
- [API Reference](https://agenda.github.io/agenda/)

## Related Packages

- [agendash](https://www.npmjs.com/package/agendash) - Web dashboard for Agenda
- [agenda-rest](https://www.npmjs.com/package/agenda-rest) - REST API for Agenda

## License

MIT
