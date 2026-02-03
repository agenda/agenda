# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agenda is a lightweight job scheduling library for Node.js with pluggable storage backends. It's a TypeScript rewrite of agenda.js with full typing and improvements for distributed job processing.

This is a pnpm monorepo with the following packages:
- `packages/agenda` - Core scheduler (published as "agenda" on npm)
- `packages/mongo-backend` - MongoDB backend (published as "@agendajs/mongo-backend" on npm)
- `packages/postgres-backend` - PostgreSQL backend (published as "@agendajs/postgres-backend" on npm)
- `packages/redis-backend` - Redis backend (published as "@agendajs/redis-backend" on npm)
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
├── MongoJobRepository                    # MongoDB data layer abstraction
└── MongoChangeStreamNotificationChannel  # Real-time notifications via Change Streams
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

**Pluggable Backend System**: Agenda uses a backend interface (`AgendaBackend`) that provides:
- Storage (required): via `JobRepository`
- Notifications (optional): via `NotificationChannel`

All backends are separate packages:
- MongoDB: `@agendajs/mongo-backend` - Storage with polling-based job processing (or real-time via Change Streams)
- PostgreSQL: `@agendajs/postgres-backend` - Storage + LISTEN/NOTIFY for real-time notifications
- Redis: `@agendajs/redis-backend` - Storage + Pub/Sub for real-time notifications

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
import { MongoBackend } from '@agendajs/mongo-backend';

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
  removeOnComplete: false,      // Auto-remove completed one-time jobs
}
```

## Basic Usage

```typescript
import { Agenda } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';

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
import { MongoBackend } from '@agendajs/mongo-backend';

const agenda = new Agenda({
  backend: new MongoBackend({ mongo: db })
});

// With in-memory notifications (single process, testing)
import { Agenda, InMemoryNotificationChannel } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';

const agenda = new Agenda({
  backend: new MongoBackend({ mongo: db }),
  notificationChannel: new InMemoryNotificationChannel()
});

// Or via fluent API
const agenda = new Agenda({ backend: new MongoBackend({ mongo: db }) })
  .notifyVia(new InMemoryNotificationChannel());

// Unified backend with notifications (e.g., PostgreSQL with LISTEN/NOTIFY)
import { PostgresBackend } from '@agendajs/postgres-backend';

const agenda = new Agenda({
  backend: new PostgresBackend({ connectionString: 'postgres://...' })
  // PostgresBackend provides both repository AND notificationChannel
});
```

### Implementing Custom Backends/Channels

For distributed setups, implement `AgendaBackend` and optionally `NotificationChannel`:

```typescript
import { AgendaBackend, BaseNotificationChannel, JobNotification } from 'agenda';

class RedisNotificationChannel extends BaseNotificationChannel {
  async connect(): Promise<void> {
    // Connect to Redis
    this.setState('connected');
  }

  async disconnect(): Promise<void> {
    // Disconnect from Redis
    this.setState('disconnected');
  }

  async publish(notification: JobNotification): Promise<void> {
    // Publish to Redis channel
    await this.redis.publish(this.config.channelName, JSON.stringify(notification));
  }
}

// Use with MongoDB storage
import { MongoBackend } from '@agendajs/mongo-backend';

const agenda = new Agenda({
  backend: new MongoBackend({ mongo: db }),
  notificationChannel: new RedisNotificationChannel()
});
```

### MongoDB Change Streams (Native MongoDB Notifications)

For MongoDB-only deployments, you can use `MongoChangeStreamNotificationChannel` from `@agendajs/mongo-backend` to enable real-time notifications without an external system like Redis:

```typescript
import { Agenda } from 'agenda';
import { MongoBackend, MongoChangeStreamNotificationChannel } from '@agendajs/mongo-backend';

// Create agenda with MongoDB storage AND change stream notifications
const agenda = new Agenda({
  backend: new MongoBackend({ mongo: db }),
  notificationChannel: new MongoChangeStreamNotificationChannel({ db })
});

// Jobs are processed immediately when created (no polling delay)
await agenda.start();
await agenda.now('myJob'); // Triggers instant processing via change stream
```

**Requirements:**
- MongoDB must be deployed as a replica set (even single-node replica sets work)
- WiredTiger storage engine (default since MongoDB 3.2)

**How it works:**
- Uses MongoDB Change Streams to watch the jobs collection
- Automatically detects job inserts/updates and notifies the job processor
- The `publish()` method is a no-op since changes are detected automatically
- Supports resume tokens for recovery after disconnections

**Configuration:**
```typescript
const channel = new MongoChangeStreamNotificationChannel({
  db: mongoDb,                    // Required: MongoDB database instance
  collection: 'agendaJobs',       // Optional: collection name (default: 'agendaJobs')
  resumeToken: savedToken,        // Optional: resume from specific point
  fullDocument: true              // Optional: include full document on updates (default: true)
});
```

### Key Types

- `AgendaBackend` - Interface for backend implementations (storage + optional notifications)
- `JobRepository` - Interface for storage operations
- `NotificationChannel` - Interface for notification channel implementations
- `JobNotification` - Payload sent when a job is saved (jobId, jobName, nextRunAt, priority)
- `BaseNotificationChannel` - Abstract base class with state management and reconnection logic
- `InMemoryNotificationChannel` - In-memory implementation for testing/single-process
- `MongoChangeStreamNotificationChannel` - MongoDB Change Streams for native real-time notifications (from `@agendajs/mongo-backend`)

## Job Debouncing

Debouncing allows you to combine multiple rapid job submissions into a single execution. This is useful for scenarios like:
- Updating a search index after rapid document changes
- Syncing user data after multiple rapid updates
- Rate-limiting notifications

### How It Works

Debouncing uses the `unique()` constraint combined with a `.debounce()` modifier. When multiple saves occur for the same unique key within the debounce window, only one job execution happens.

```
Timeline: job.save() calls for same unique key
          ↓       ↓       ↓
          T=0     T=2s    T=4s                 T=9s

TRAILING (default):
  nextRunAt: 5s  →  7s  →  9s        executes→ ✓
  Effect: Waits for "quiet period", runs once at end

LEADING:
  nextRunAt: 0   →  0   →  0         executes→ ✓ (at T=0)
  Effect: Runs immediately on first call, ignores rest during window
```

### Usage

```typescript
// Basic trailing debounce - execute 2s after last save
await agenda.create('updateSearchIndex', { entityType: 'products' })
  .unique({ 'data.entityType': 'products' })
  .debounce(2000)
  .save();

// Multiple rapid calls → single execution after 2s quiet period
for (const change of rapidChanges) {
  await agenda.create('updateSearchIndex', { entityType: 'products', change })
    .unique({ 'data.entityType': 'products' })
    .debounce(2000)
    .save();
}
// → Executes once with the last change's data

// With maxWait - guarantee execution within 30s
await agenda.create('syncUserActivity', { userId: 123 })
  .unique({ 'data.userId': 123 })
  .debounce(5000, { maxWait: 30000 })
  .save();
// → Even with continuous saves, job runs within 30s

// Leading strategy - execute immediately, ignore subsequent calls
await agenda.create('sendNotification', { channel: '#alerts' })
  .unique({ 'data.channel': '#alerts' })
  .debounce(60000, { strategy: 'leading' })
  .save();
// → First call executes immediately, subsequent calls within 60s are ignored
```

### Debounce Options

```typescript
interface DebounceOptions {
  delay: number;                        // Debounce window in milliseconds (required)
  maxWait?: number;                     // Max time before forced execution
  strategy?: 'trailing' | 'leading';    // Default: 'trailing'
}
```

- **trailing** (default): Execute after quiet period ends. Each save resets the timer.
- **leading**: Execute immediately on first call, ignore subsequent calls during window.
- **maxWait**: With trailing strategy, guarantees execution within maxWait even if saves keep coming.

### Requirements

- Debounce requires a `unique()` constraint to identify which jobs should be debounced together
- Without `unique()`, each save creates a new job (no debouncing occurs)
- The debounce state (`debounceStartedAt`) is persisted in the database, so it survives process restarts
