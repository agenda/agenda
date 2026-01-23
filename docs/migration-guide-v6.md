# Migration Guide: Agenda v5 to v6

This guide covers all breaking changes and new features in Agenda v6.

## Overview of Major Changes

1. **ESM-only** - CommonJS is no longer supported
2. **Unified Backend API** - New `IAgendaBackend` interface replaces direct database configuration
3. **Monorepo structure** - Now includes `agenda`, `agendash`, and `agenda-rest` packages
4. **Node.js 18+** - Minimum Node.js version is now 18
5. **MongoDB 6+** - MongoDB driver updated to v6
6. **TypeScript improvements** - Better typing throughout
7. **Real-time notifications** - New pluggable notification channel system

---

## Breaking Changes

### 1. ESM-Only Package

Agenda v6 is now ESM-only. CommonJS `require()` is no longer supported.

**Before (v5):**
```javascript
const Agenda = require('agenda');
// or
const { Agenda } = require('agenda');
```

**After (v6):**
```javascript
import { Agenda, MongoBackend } from 'agenda';
```

If you need to use Agenda in a CommonJS project, you can use dynamic imports:
```javascript
const { Agenda, MongoBackend } = await import('agenda');
```

### 2. New Backend API (Major Breaking Change)

The most significant change in v6 is the new backend architecture. Instead of passing database options directly to Agenda, you now create a backend instance.

**Before (v5):**
```javascript
// Via connection string
const agenda = new Agenda({
  db: { address: 'mongodb://localhost/agenda', collection: 'jobs' }
});

// Via existing MongoDB connection
const agenda = new Agenda({ mongo: mongoDb });

// Via custom repository
const agenda = new Agenda({ repository: myCustomRepo });

// With other options
const agenda = new Agenda({
  mongo: mongoDb,
  processEvery: '30 seconds',
  maxConcurrency: 20,
  ensureIndex: true,
  sort: { nextRunAt: 1, priority: -1 }
});
```

**After (v6):**
```javascript
import { Agenda, MongoBackend } from 'agenda';

// Via connection string
const agenda = new Agenda({
  backend: new MongoBackend({ address: 'mongodb://localhost/agenda', collection: 'jobs' })
});

// Via existing MongoDB connection
const agenda = new Agenda({
  backend: new MongoBackend({ mongo: mongoDb })
});

// With other options (note: ensureIndex and sort go to MongoBackend)
const agenda = new Agenda({
  backend: new MongoBackend({
    mongo: mongoDb,
    ensureIndex: true,
    sort: { nextRunAt: 1, priority: -1 }
  }),
  processEvery: '30 seconds',
  maxConcurrency: 20
});
```

### 3. Configuration Options Reorganization

Options have been split between Agenda and MongoBackend:

| Option | v5 Location | v6 Location |
|--------|-------------|-------------|
| `db.address` | Agenda | `MongoBackend({ address })` |
| `db.collection` | Agenda | `MongoBackend({ collection })` |
| `db.options` | Agenda | `MongoBackend({ options })` |
| `mongo` | Agenda | `MongoBackend({ mongo })` |
| `repository` | Agenda | Use custom `IAgendaBackend` |
| `ensureIndex` | Agenda | `MongoBackend({ ensureIndex })` |
| `sort` | Agenda | `MongoBackend({ sort })` |
| `processEvery` | Agenda | Agenda (unchanged) |
| `maxConcurrency` | Agenda | Agenda (unchanged) |
| `defaultConcurrency` | Agenda | Agenda (unchanged) |
| `lockLimit` | Agenda | Agenda (unchanged) |
| `defaultLockLimit` | Agenda | Agenda (unchanged) |
| `defaultLockLifetime` | Agenda | Agenda (unchanged) |
| `name` | Agenda | Agenda (unchanged) |
| `forkHelper` | Agenda | Agenda (unchanged) |
| `forkedWorker` | Agenda | Agenda (unchanged) |

### 4. Removed Features

The following features from agenda.js v4 are **not supported** in v6:

| Feature | Status | Alternative |
|---------|--------|-------------|
| `shouldSaveResult` | Removed | Store results manually in job data |
| `drain()` method | Removed | Use `stop()` and wait for jobs to complete |
| `_collection` internal access | Removed | Use `agenda.db` (IJobRepository) |
| Top-level `disable()`/`enable()` | Removed | Use `job.disable()`/`job.enable()` on individual jobs |
| `startDate`/`endDate` in scheduling | Not implemented | Filter manually in job processor |

### 5. Node.js Version Requirement

**Before (v5):** Node.js 14+
**After (v6):** Node.js 18+

### 6. MongoDB Driver Version

**Before (v5):** MongoDB driver v4
**After (v6):** MongoDB driver v6

This may require updates if you're using MongoDB connection options that changed between driver versions.

---

## New Features

### 1. Real-Time Notification Channels

Agenda v6 introduces a pluggable notification system for real-time job processing across distributed systems.

**Basic usage (single process):**
```javascript
import { Agenda, MongoBackend, InMemoryNotificationChannel } from 'agenda';

const agenda = new Agenda({
  backend: new MongoBackend({ mongo: db }),
  processEvery: '30 seconds', // Fallback polling interval
  notificationChannel: new InMemoryNotificationChannel()
});
```

**With fluent API:**
```javascript
const agenda = new Agenda({ backend: new MongoBackend({ mongo: db }) })
  .notifyVia(new InMemoryNotificationChannel());
```

**Custom notification channel (e.g., Redis):**
```javascript
import { BaseNotificationChannel, IJobNotification } from 'agenda';

class RedisNotificationChannel extends BaseNotificationChannel {
  async connect() {
    await this.redis.connect();
    await this.redis.subscribe(this.config.channelName, (message) => {
      this.notifyHandlers(JSON.parse(message));
    });
    this.setState('connected');
  }

  async disconnect() {
    await this.redis.unsubscribe(this.config.channelName);
    await this.redis.disconnect();
    this.setState('disconnected');
  }

  async publish(notification: IJobNotification) {
    await this.redis.publish(this.config.channelName, JSON.stringify(notification));
  }
}
```

### 2. Unified Backend Interface

The new `IAgendaBackend` interface allows creating backends that provide both storage AND notifications:

```javascript
class PostgresBackend implements IAgendaBackend {
  readonly repository: IJobRepository;
  readonly notificationChannel: INotificationChannel;

  constructor(config) {
    this.repository = new PostgresRepository(config);
    this.notificationChannel = new PostgresListenNotify(config);
  }

  async connect() {
    await this.repository.connect();
    await this.notificationChannel.connect();
  }

  async disconnect() {
    await this.notificationChannel.disconnect();
    // Close pool
  }
}

// Single backend provides both storage and notifications
const agenda = new Agenda({
  backend: new PostgresBackend({ connectionString: 'postgres://...' })
});
```

### 3. Database-Agnostic Repository Interface

The `IJobRepository` interface allows implementing custom storage backends:

```javascript
import { IJobRepository, IJobParameters } from 'agenda';

class SQLiteRepository implements IJobRepository {
  async connect() { /* ... */ }
  async queryJobs(options) { /* ... */ }
  async saveJob(job) { /* ... */ }
  async getNextJobToRun(name, nextScanAt, lockDeadline) { /* ... */ }
  // ... implement all required methods
}
```

### 4. Improved TypeScript Support

Full TypeScript support with better generic types:

```javascript
interface MyJobData {
  userId: string;
  action: 'send-email' | 'process-payment';
}

agenda.define<MyJobData>('my-job', async (job) => {
  // job.attrs.data is typed as MyJobData
  console.log(job.attrs.data.userId);
});

await agenda.now<MyJobData>('my-job', { userId: '123', action: 'send-email' });
```

### 5. Progress Tracking in touch()

The `touch()` method now accepts an optional progress parameter:

```javascript
agenda.define('long-job', async (job) => {
  for (let i = 0; i <= 100; i += 10) {
    await doWork();
    await job.touch(i); // Report progress 0-100
  }
});
```

### 6. getRunningStats()

Get detailed statistics about running jobs:

```javascript
const stats = await agenda.getRunningStats();
console.log(stats);
// {
//   version: '6.0.0',
//   queueName: 'myAgenda',
//   totalQueueSizeDB: 150,
//   config: { ... },
//   internal: { ... },
//   jobStatus: { ... }
// }
```

---

## Migration Steps

### Step 1: Update Node.js

Ensure you're running Node.js 18 or higher:
```bash
node --version  # Should be v18.0.0 or higher
```

### Step 2: Update Package

```bash
npm install agenda@6
# or
pnpm add agenda@6
# or
yarn add agenda@6
```

### Step 3: Update Imports

Change from CommonJS to ESM:

```javascript
// Before
const Agenda = require('agenda');

// After
import { Agenda, MongoBackend } from 'agenda';
```

If your project uses CommonJS, update `package.json`:
```json
{
  "type": "module"
}
```

Or use `.mjs` extension for ESM files.

### Step 4: Update Agenda Instantiation

Replace direct database configuration with MongoBackend:

```javascript
// Before
const agenda = new Agenda({
  db: { address: 'mongodb://localhost/agenda' },
  processEvery: '1 minute'
});

// After
import { Agenda, MongoBackend } from 'agenda';

const agenda = new Agenda({
  backend: new MongoBackend({ address: 'mongodb://localhost/agenda' }),
  processEvery: '1 minute'
});
```

### Step 5: Move Backend-Specific Options

Move `ensureIndex` and `sort` to MongoBackend:

```javascript
// Before
const agenda = new Agenda({
  mongo: db,
  ensureIndex: true,
  sort: { priority: -1 }
});

// After
const agenda = new Agenda({
  backend: new MongoBackend({
    mongo: db,
    ensureIndex: true,
    sort: { priority: -1 }
  })
});
```

### Step 6: Update Custom Repository Usage

If using a custom repository, implement `IAgendaBackend`:

```javascript
// Before
const agenda = new Agenda({
  repository: myCustomRepo
});

// After
class MyCustomBackend implements IAgendaBackend {
  readonly repository = myCustomRepo;
  readonly notificationChannel = undefined; // Optional

  async connect() {
    await this.repository.connect();
  }

  async disconnect() {
    // Cleanup
  }
}

const agenda = new Agenda({
  backend: new MyCustomBackend()
});
```

### Step 7: Update Tests

Update test setup to use new API:

```javascript
// Before
const agenda = new Agenda({ mongo: testDb });

// After
import { Agenda, MongoBackend } from 'agenda';
const agenda = new Agenda({ backend: new MongoBackend({ mongo: testDb }) });
```

---

## Complete Migration Example

### Before (v5):

```javascript
const Agenda = require('agenda');
const { MongoClient } = require('mongodb');

async function main() {
  const client = await MongoClient.connect('mongodb://localhost:27017');
  const db = client.db('myapp');

  const agenda = new Agenda({
    mongo: db,
    processEvery: '30 seconds',
    defaultConcurrency: 5,
    maxConcurrency: 20,
    ensureIndex: true
  });

  agenda.define('send-email', async (job) => {
    const { to, subject, body } = job.attrs.data;
    await sendEmail(to, subject, body);
  });

  await agenda.start();
  await agenda.every('1 hour', 'send-email', { to: 'user@example.com', subject: 'Hello' });
}
```

### After (v6):

```javascript
import { Agenda, MongoBackend } from 'agenda';
import { MongoClient } from 'mongodb';

async function main() {
  const client = await MongoClient.connect('mongodb://localhost:27017');
  const db = client.db('myapp');

  const agenda = new Agenda({
    backend: new MongoBackend({
      mongo: db,
      ensureIndex: true
    }),
    processEvery: '30 seconds',
    defaultConcurrency: 5,
    maxConcurrency: 20
  });

  agenda.define('send-email', async (job) => {
    const { to, subject, body } = job.attrs.data;
    await sendEmail(to, subject, body);
  });

  await agenda.start();
  await agenda.every('1 hour', 'send-email', { to: 'user@example.com', subject: 'Hello' });
}
```

---

## Troubleshooting

### Error: "Cannot use require() to import an ES module"

You're trying to use CommonJS `require()` with Agenda v6. Switch to ESM imports:

```javascript
// Use this
import { Agenda, MongoBackend } from 'agenda';

// Or dynamic import in CommonJS
const { Agenda, MongoBackend } = await import('agenda');
```

### Error: "backend is required"

You forgot to provide a backend. Agenda v6 requires explicit backend configuration:

```javascript
// Wrong
const agenda = new Agenda({ mongo: db });

// Correct
const agenda = new Agenda({ backend: new MongoBackend({ mongo: db }) });
```

### Error: "Cannot read properties of undefined (reading 'repository')"

Same as above - you need to provide a backend.

### MongoDB Connection Issues

The MongoDB driver was upgraded from v4 to v6. Check if your connection options are still valid:

```javascript
// Some options may have changed
const agenda = new Agenda({
  backend: new MongoBackend({
    address: 'mongodb://localhost/agenda',
    options: {
      // Check MongoDB driver v6 documentation for valid options
    }
  })
});
```

---

## Additional Resources

- [Custom Backend Driver Documentation](./custom-database-driver.md)
- [GitHub Issues](https://github.com/agenda/agenda/issues)
- [Full API Documentation](https://agenda.github.io/agenda/)
