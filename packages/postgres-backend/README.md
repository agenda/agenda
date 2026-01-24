# @agenda.js/postgres-backend

PostgreSQL backend for [Agenda](https://github.com/agenda/agenda) job scheduler with LISTEN/NOTIFY support for real-time job processing.

## Features

- Full PostgreSQL storage backend for Agenda jobs
- Real-time job notifications using PostgreSQL LISTEN/NOTIFY
- Automatic schema creation with optimized indexes
- Connection pooling via `pg` library
- TypeScript support with full type definitions

## Installation

```bash
npm install @agenda.js/postgres-backend
# or
pnpm add @agenda.js/postgres-backend
# or
yarn add @agenda.js/postgres-backend
```

## Usage

### Basic Usage

```typescript
import { Agenda } from 'agenda';
import { PostgresBackend } from '@agenda.js/postgres-backend';

// Create agenda with PostgreSQL backend
const agenda = new Agenda({
  backend: new PostgresBackend({
    connectionString: 'postgresql://user:pass@localhost:5432/mydb'
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
import { PostgresBackend } from '@agenda.js/postgres-backend';

const backend = new PostgresBackend({
  // PostgreSQL connection string (required unless pool is provided)
  connectionString: 'postgresql://user:pass@localhost:5432/mydb',

  // Or use pool configuration
  pool: {
    host: 'localhost',
    port: 5432,
    database: 'mydb',
    user: 'user',
    password: 'pass',
    max: 20 // max pool size
  },

  // Table name for jobs (default: 'agenda_jobs')
  tableName: 'agenda_jobs',

  // Channel name for LISTEN/NOTIFY (default: 'agenda_jobs')
  channelName: 'agenda_jobs',

  // Name to identify this Agenda instance (stored as lastModifiedBy)
  name: 'worker-1',

  // Whether to create the table and indexes on connect (default: true)
  ensureSchema: true,

  // Sort order for job queries
  sort: {
    nextRunAt: 1,  // 1 for ASC, -1 for DESC
    priority: -1
  }
});
```

## How It Works

### Storage

The backend stores jobs in a PostgreSQL table with the following structure:

- `id` - UUID primary key
- `name` - Job name
- `priority` - Job priority (higher = more urgent)
- `next_run_at` - When the job should run next
- `type` - Job type ('normal' or 'single')
- `locked_at` - Lock timestamp for distributed execution
- `data` - JSONB payload for job data
- And other metadata fields...

### Real-Time Notifications

Unlike MongoDB, PostgreSQL has built-in pub/sub via LISTEN/NOTIFY. When a job is saved, a notification is published to all listening Agenda instances, triggering immediate job processing without waiting for the next poll interval.

This means:
- Lower latency for job execution
- Reduced database polling overhead
- Efficient cross-process coordination

### Distributed Locking

The backend uses PostgreSQL's `FOR UPDATE SKIP LOCKED` to atomically lock jobs for processing, preventing duplicate execution across multiple Agenda instances.

## Database Indexes

When `ensureSchema: true` (default), the following indexes are created:

```sql
-- Main index for finding and locking next job
CREATE INDEX agenda_jobs_find_and_lock_idx
  ON agenda_jobs (name, next_run_at, priority DESC, locked_at, disabled)
  WHERE disabled = FALSE;

-- Index for single jobs (upsert operations)
CREATE UNIQUE INDEX agenda_jobs_single_job_idx
  ON agenda_jobs (name) WHERE type = 'single';

-- Index for locked_at (stale lock detection)
CREATE INDEX agenda_jobs_locked_at_idx
  ON agenda_jobs (locked_at) WHERE locked_at IS NOT NULL;

-- Index for next_run_at queries
CREATE INDEX agenda_jobs_next_run_at_idx
  ON agenda_jobs (next_run_at) WHERE next_run_at IS NOT NULL;
```

## Manual Schema Management

If you prefer to manage the schema yourself (set `ensureSchema: false`):

```typescript
import { getCreateTableSQL, getCreateIndexesSQL } from '@agenda.js/postgres-backend';

const tableName = 'agenda_jobs';

// Create table
await pool.query(getCreateTableSQL(tableName));

// Create indexes
for (const sql of getCreateIndexesSQL(tableName)) {
  await pool.query(sql);
}
```

## Testing

Tests require a PostgreSQL database. The easiest way is to use Docker:

```bash
# Start PostgreSQL container and run tests
pnpm test:docker

# Or manually:
pnpm docker:up        # Start PostgreSQL container
pnpm test:postgres    # Run tests
pnpm docker:down      # Stop container
```

You can also use an existing PostgreSQL database:

```bash
POSTGRES_TEST_URL=postgresql://user:pass@localhost:5432/agenda_test pnpm test
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm test` | Run tests (skips PostgreSQL tests if no database) |
| `pnpm test:postgres` | Run tests with local Docker PostgreSQL |
| `pnpm test:docker` | Start container, run tests, stop container |
| `pnpm docker:up` | Start PostgreSQL container |
| `pnpm docker:down` | Stop PostgreSQL container |
| `pnpm docker:logs` | View container logs |

## Requirements

- Node.js >= 18.0.0
- PostgreSQL >= 12 (for `gen_random_uuid()` support)
- Agenda >= 6.0.0

## License

MIT
