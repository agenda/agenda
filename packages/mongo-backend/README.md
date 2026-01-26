# @agenda.js/mongo-backend

MongoDB backend for [Agenda](https://www.npmjs.com/package/agenda) job scheduler.

## Installation

```bash
npm install agenda @agenda.js/mongo-backend
# or
pnpm add agenda @agenda.js/mongo-backend
# or
yarn add agenda @agenda.js/mongo-backend
```

**Requirements:**
- Node.js 18+
- MongoDB 4+

## Usage

```typescript
import { Agenda } from 'agenda';
import { MongoBackend } from '@agenda.js/mongo-backend';

// Via connection string
const agenda = new Agenda({
  backend: new MongoBackend({
    address: 'mongodb://localhost/agenda'
  })
});

// Or via existing MongoDB connection
import { MongoClient } from 'mongodb';

const client = await MongoClient.connect('mongodb://localhost');
const db = client.db('agenda');

const agenda = new Agenda({
  backend: new MongoBackend({ mongo: db })
});

// Define jobs
agenda.define('send-email', async (job) => {
  const { to, subject } = job.attrs.data;
  await sendEmail(to, subject);
});

// Start processing
await agenda.start();

// Schedule jobs
await agenda.every('1 hour', 'send-email', { to: 'user@example.com', subject: 'Hello' });
```

## Configuration Options

```typescript
interface IMongoBackendConfig {
  /** MongoDB connection string */
  address?: string;

  /** Existing MongoDB database instance */
  mongo?: Db;

  /** Collection name for jobs (default: 'agendaJobs') */
  collection?: string;

  /** MongoDB client options */
  options?: MongoClientOptions;

  /** Name to identify this Agenda instance (stored as lastModifiedBy) */
  name?: string;

  /** Whether to create indexes on connect (default: true) */
  ensureIndex?: boolean;

  /** Sort order for job queries */
  sort?: { [key: string]: SortDirection };
}
```

### Full Example with Options

```typescript
const agenda = new Agenda({
  backend: new MongoBackend({
    address: 'mongodb://localhost/agenda',
    collection: 'jobs',           // Custom collection name
    sort: { nextRunAt: 'asc', priority: 'desc' }
  }),
  processEvery: '30 seconds',     // Job polling interval
  maxConcurrency: 20,             // Max concurrent jobs
  defaultConcurrency: 5           // Default per job type
});
```

## Real-Time Notifications

MongoBackend provides storage only and uses polling to check for new jobs. For real-time job processing across distributed systems, combine it with a notification channel:

```typescript
import { Agenda, InMemoryNotificationChannel } from 'agenda';
import { MongoBackend } from '@agenda.js/mongo-backend';

// For single-process apps (testing/development)
const agenda = new Agenda({
  backend: new MongoBackend({ mongo: db }),
  notificationChannel: new InMemoryNotificationChannel()
});

// For production: use Redis for notifications
import { RedisBackend } from '@agenda.js/redis-backend';

const redisBackend = new RedisBackend({ connectionString: 'redis://localhost:6379' });
const agenda = new Agenda({
  backend: new MongoBackend({ mongo: db }),
  notificationChannel: redisBackend.notificationChannel
});
```

## Database Index

By default, MongoBackend automatically creates the `findAndLockNextJobIndex` index on connect for optimal job query performance. The index includes:

```javascript
{
  "name": 1,
  "nextRunAt": 1,
  "priority": -1,
  "lockedAt": 1,
  "disabled": 1
}
```

To disable automatic index creation (e.g., if you manage indexes separately):

```typescript
const backend = new MongoBackend({
  mongo: db,
  ensureIndex: false  // Skip automatic index creation
});
```

### Additional Indexes

If you use **Agendash**, add this index for better dashboard performance:

```javascript
db.agendaJobs.createIndex({
  "nextRunAt": -1,
  "lastRunAt": -1,
  "lastFinishedAt": -1
}, { name: "agendash" })
```

If you have job definitions with thousands of instances, this index can improve lock queries:

```javascript
db.agendaJobs.createIndex({
  "name": 1,
  "disabled": 1,
  "lockedAt": 1
}, { name: "findAndLockDeadJobs" })
```

## Related Packages

- [agenda](https://www.npmjs.com/package/agenda) - Core scheduler
- [@agenda.js/postgres-backend](https://www.npmjs.com/package/@agenda.js/postgres-backend) - PostgreSQL backend with LISTEN/NOTIFY
- [@agenda.js/redis-backend](https://www.npmjs.com/package/@agenda.js/redis-backend) - Redis backend with Pub/Sub

## License

MIT
