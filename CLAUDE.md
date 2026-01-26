# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agenda is a lightweight job scheduling library for Node.js with pluggable storage backends. It's a TypeScript rewrite of agenda.js with full typing and improvements for distributed job processing.

This is a pnpm monorepo with the following packages:
- `packages/agenda` - Core scheduler (published as "agenda" on npm)
- `packages/mongo-backend` - MongoDB backend (published as "@agenda.js/mongo-backend" on npm)
- `packages/postgres-backend` - PostgreSQL backend (published as "@agenda.js/postgres-backend" on npm)
- `packages/redis-backend` - Redis backend (published as "@agenda.js/redis-backend" on npm)
- `packages/agendash` - Placeholder for dashboard integration

## Common Commands

```bash
# Build all packages
pnpm build

# Testing (runs all package tests)
pnpm test

# Run agenda package tests directly
pnpm --filter agenda test

# Run single test file
pnpm --filter agenda exec vitest run test/job.test.ts

# Run tests matching a pattern
pnpm --filter agenda exec vitest run --grep "pattern"

# Debug with agenda logging
DEBUG=agenda:**,-agenda:internal:** pnpm --filter agenda test
DEBUG=agenda:** pnpm --filter agenda test

# Linting
pnpm lint                        # ESLint check
pnpm lint:fix                    # ESLint with auto-fix
```

## Architecture

### Core Components

```
Agenda (packages/agenda/src/index.ts)    # Main class, extends EventEmitter
├── JobProcessor                          # Handles job execution loop and concurrency
├── Job                                   # Individual job with lifecycle methods
├── JobProcessingQueue                    # Priority queue for pending jobs
└── notifications/                        # Pluggable notification channel system
    ├── BaseNotificationChannel           # Abstract base with reconnection logic
    └── InMemoryNotificationChannel       # In-memory implementation for testing

MongoBackend (packages/mongo-backend)     # Separate package for MongoDB
├── MongoBackend                          # MongoDB backend implementation
└── MongoJobRepository                    # MongoDB data layer abstraction
```

### Source Structure

- `packages/agenda/src/index.ts` - Agenda class: configuration, job definition, scheduling API
- `packages/agenda/src/Job.ts` - Job class: save, remove, run, touch, schedule methods
- `packages/agenda/src/JobProcessor.ts` - Processing loop, locking, concurrent execution
- `packages/agenda/src/JobProcessingQueue.ts` - Priority-based job queue
- `packages/agenda/src/types/` - TypeScript interfaces (AgendaConfig, JobDefinition, JobParameters)
- `packages/agenda/src/utils/` - Helpers for priority parsing, interval calculation, date handling
- `packages/mongo-backend/src/` - MongoDB backend implementation (separate package)
- `packages/postgres-backend/src/` - PostgreSQL backend implementation
- `packages/redis-backend/src/` - Redis backend implementation

### Key Patterns

**Pluggable Backend System**: Agenda uses a backend interface (`IAgendaBackend`) that provides:
- Storage (required): via `IJobRepository`
- Notifications (optional): via `INotificationChannel`

All backends are separate packages:
- MongoDB: `@agenda.js/mongo-backend` - Storage with polling-based job processing
- PostgreSQL: `@agenda.js/postgres-backend` - Storage + LISTEN/NOTIFY for real-time notifications
- Redis: `@agenda.js/redis-backend` - Storage + Pub/Sub for real-time notifications

**Event-Driven Architecture**: Agenda emits events for job lifecycle:
- `start`, `complete`, `success`, `fail` (with job-specific variants like `start:jobName`)
- `ready`, `error` for Agenda lifecycle

**Distributed Locking**: Jobs use `lockedAt` field for distributed execution:
- Prevents duplicate execution across multiple Agenda instances
- Default lock lifetime: 10 minutes (configurable per job)

**Job Scheduling Formats**:
- Human-readable: `'3 minutes'`, `'1 week'`
- Cron: `'*/5 * * * *'`
- Milliseconds: `5000`

**Job Types**:
- `normal` - Regular job, can have multiple instances
- `single` - Only one instance in DB (used by `.every()`)

### Testing

Tests use mongodb-memory-server for isolation. Test helper at `packages/agenda/test/helpers/mock-mongodb.ts`:

```typescript
import { mockMongo } from './helpers/mock-mongodb';
import { Agenda } from 'agenda';
import { MongoBackend } from '@agenda.js/mongo-backend';

const { db, disconnect } = await mockMongo();
const agenda = new Agenda({ backend: new MongoBackend({ mongo: db }) });
// ... tests
disconnect();
```

## Configuration Defaults

```typescript
{
  processEvery: 5000,           // Scan interval (ms)
  defaultConcurrency: 5,        // Per-job concurrency
  maxConcurrency: 20,           // Global max running jobs
  defaultLockLifetime: 600000,  // 10 minutes
}
```

## Basic Usage

```typescript
import { Agenda } from 'agenda';
import { MongoBackend } from '@agenda.js/mongo-backend';

// Create agenda with MongoDB backend
const agenda = new Agenda({
  backend: new MongoBackend({ address: 'mongodb://localhost/agenda' })
});

// Or with existing connection
const agenda = new Agenda({
  backend: new MongoBackend({ mongo: existingDb })
});

// IMPORTANT: Always attach an error handler to prevent unhandled promise rejections
agenda.on('error', (err) => {
  console.error('Agenda error:', err);
});

// Define and run jobs
agenda.define('myJob', async (job) => {
  console.log('Running job:', job.attrs.name);
});

await agenda.start();
await agenda.every('5 minutes', 'myJob');
```

## Database Index

When using MongoDB, Agenda does not create indexes by default. Recommended index for production:

```javascript
db.agendaJobs.createIndex({
  "name": 1,
  "nextRunAt": 1,
  "priority": -1,
  "lockedAt": 1,
  "disabled": 1
}, { name: "findAndLockNextJobIndex" })
```

## Debug Logging

Uses the `debug` library with namespace `agenda:*`:

```bash
DEBUG=agenda:* pnpm test        # All agenda logs
DEBUG=agenda:job pnpm test      # Job-specific logs
DEBUG=agenda:jobProcessor pnpm test  # Processor logs
```

## Notification Channel (Real-Time Job Processing)

By default, Agenda uses periodic polling (`processEvery`) to check for new jobs. For real-time job processing across multiple processes, you can configure a notification channel.

### Architecture

```
Thread 1 (API/Scheduler)          Thread 2 (Worker)
├── job.save()                    ├── agenda.start()
│   └── notificationChannel       ├── notificationChannel.subscribe()
│       .publish({jobId})  ─────> │   handleNotification()
│                                 │   └── jobQueueFilling()
│                                 │   └── jobProcessing()
```

### Usage

```typescript
// Without notifications (default) - uses periodic polling only
import { Agenda } from 'agenda';
import { MongoBackend } from '@agenda.js/mongo-backend';

const agenda = new Agenda({
  backend: new MongoBackend({ mongo: db })
});

// With in-memory notifications (single process, testing)
import { Agenda, InMemoryNotificationChannel } from 'agenda';
import { MongoBackend } from '@agenda.js/mongo-backend';

const agenda = new Agenda({
  backend: new MongoBackend({ mongo: db }),
  notificationChannel: new InMemoryNotificationChannel()
});

// Or via fluent API
const agenda = new Agenda({ backend: new MongoBackend({ mongo: db }) })
  .notifyVia(new InMemoryNotificationChannel());

// Unified backend with notifications (e.g., PostgreSQL with LISTEN/NOTIFY)
import { PostgresBackend } from '@agenda.js/postgres-backend';

const agenda = new Agenda({
  backend: new PostgresBackend({ connectionString: 'postgres://...' })
  // PostgresBackend provides both repository AND notificationChannel
});
```

### Implementing Custom Backends/Channels

For distributed setups, implement `IAgendaBackend` and optionally `INotificationChannel`:

```typescript
import { IAgendaBackend, BaseNotificationChannel, IJobNotification } from 'agenda';

class RedisNotificationChannel extends BaseNotificationChannel {
  async connect(): Promise<void> {
    // Connect to Redis
    this.setState('connected');
  }

  async disconnect(): Promise<void> {
    // Disconnect from Redis
    this.setState('disconnected');
  }

  async publish(notification: IJobNotification): Promise<void> {
    // Publish to Redis channel
    await this.redis.publish(this.config.channelName, JSON.stringify(notification));
  }
}

// Use with MongoDB storage
import { MongoBackend } from '@agenda.js/mongo-backend';

const agenda = new Agenda({
  backend: new MongoBackend({ mongo: db }),
  notificationChannel: new RedisNotificationChannel()
});
```

### Key Types

- `IAgendaBackend` - Interface for backend implementations (storage + optional notifications)
- `IJobRepository` - Interface for storage operations
- `INotificationChannel` - Interface for notification channel implementations
- `IJobNotification` - Payload sent when a job is saved (jobId, jobName, nextRunAt, priority)
- `BaseNotificationChannel` - Abstract base class with state management and reconnection logic
- `InMemoryNotificationChannel` - In-memory implementation for testing/single-process
