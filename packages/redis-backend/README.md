# @agendajs/redis-backend

Redis backend for [Agenda](https://github.com/agenda/agenda) job scheduler with Pub/Sub support for real-time job processing.

## Features

- Full Redis storage backend for Agenda jobs
- Real-time job notifications using Redis Pub/Sub
- Efficient job indexing with sorted sets
- Atomic job locking with WATCH/MULTI/EXEC
- Connection pooling via `ioredis` library
- TypeScript support with full type definitions

## Installation

```bash
npm install @agendajs/redis-backend
# or
pnpm add @agendajs/redis-backend
# or
yarn add @agendajs/redis-backend
```

## Usage

### Basic Usage

```typescript
import { Agenda } from 'agenda';
import { RedisBackend } from '@agendajs/redis-backend';

// Create agenda with Redis backend
const agenda = new Agenda({
  backend: new RedisBackend({
    connectionString: 'redis://localhost:6379'
  })
});

// Define jobs
agenda.define('send-email', async (job) => {
  const { to, subject, body } = job.attrs.data;
  await sendEmail(to, subject, body);
});

// Start processing
await agenda.start();

// Schedule jobs
await agenda.every('5 minutes', 'send-email', { to: 'user@example.com', subject: 'Hello', body: 'World' });
await agenda.schedule('in 10 minutes', 'send-email', { to: 'other@example.com', subject: 'Hi', body: 'There' });
```

### Configuration Options

```typescript
import { RedisBackend } from '@agendajs/redis-backend';

const backend = new RedisBackend({
  // Redis connection string (required unless redis/redisOptions is provided)
  connectionString: 'redis://localhost:6379',

  // Or use Redis client options (creates a new client)
  redisOptions: {
    host: 'localhost',
    port: 6379,
    password: 'secret',
    db: 0
  },

  // Key prefix for all Redis keys (default: 'agenda:')
  keyPrefix: 'agenda:',

  // Channel name for Pub/Sub notifications (default: 'agenda:notifications')
  channelName: 'agenda:notifications',

  // Name to identify this Agenda instance (stored as lastModifiedBy)
  name: 'worker-1',

  // Sort order for job queries
  sort: {
    nextRunAt: 1,  // 1 for ASC, -1 for DESC
    priority: -1
  }
});
```

### Using an Existing Redis Client

If your application already has a Redis client, you can pass it directly. The client will **not** be closed when Agenda disconnects:

```typescript
import { Redis } from 'ioredis';
import { RedisBackend } from '@agendajs/redis-backend';

// Your app's existing Redis client
const redis = new Redis('redis://localhost:6379');

const backend = new RedisBackend({ redis });

// After agenda.stop(), your Redis client is still usable
```

## How It Works

### Storage

The backend stores jobs using Redis data structures:

- **Hashes** (`{prefix}job:{id}`) - Store job data as key-value pairs
- **Sets** (`{prefix}jobs:all`) - Track all job IDs
- **Sets** (`{prefix}jobs:by_name:{name}`) - Index jobs by name for fast lookup
- **Sorted Sets** (`{prefix}jobs:by_next_run_at`) - Index jobs by nextRunAt for efficient scheduling
- **Strings** (`{prefix}jobs:single:{name}`) - Track single-type jobs for upsert operations

### Real-Time Notifications

Redis has built-in pub/sub capabilities. When a job is saved, a notification is published to all subscribing Agenda instances, triggering immediate job processing without waiting for the next poll interval.

This means:
- Lower latency for job execution
- Reduced polling overhead
- Efficient cross-process coordination

### Distributed Locking

The backend uses Redis WATCH/MULTI/EXEC transactions to atomically lock jobs for processing, preventing duplicate execution across multiple Agenda instances.

## Persistence

By default, Redis keeps data in memory. For production use with Agenda, configure Redis persistence:

```bash
# In redis.conf
appendonly yes           # Enable AOF persistence
appendfsync everysec     # Sync to disk every second
```

Or use RDB snapshots:

```bash
save 900 1      # Save after 900 seconds if at least 1 key changed
save 300 10     # Save after 300 seconds if at least 10 keys changed
save 60 10000   # Save after 60 seconds if at least 10000 keys changed
```

For maximum durability, enable both AOF and RDB.

## Testing

Tests require a Redis server. The easiest way is to use Docker:

```bash
# Start Redis container and run tests
pnpm test:docker

# Or manually:
pnpm docker:up      # Start Redis container
pnpm test           # Run tests
pnpm docker:down    # Stop container
```

You can also use an existing Redis server:

```bash
REDIS_TEST_URL=redis://localhost:6379 pnpm test
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm test` | Run tests (requires Redis or Docker) |
| `pnpm test:docker` | Start container, run tests, stop container |
| `pnpm docker:up` | Start Redis container |
| `pnpm docker:down` | Stop Redis container |
| `pnpm docker:logs` | View container logs |

## Requirements

- Node.js >= 18.0.0
- Redis >= 6.0
- Agenda >= 6.0.0

## License

MIT
