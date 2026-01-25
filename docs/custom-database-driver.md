# Custom Backend Driver

Agenda v6 introduces a pluggable backend system (`IAgendaBackend`), allowing you to use any database and optionally provide real-time notifications.

## Official Backend Packages

Before implementing a custom backend, check if an official package already exists:

| Package | Backend | Notifications | Install |
|---------|---------|---------------|---------|
| `@agenda.js/mongo-backend` | MongoDB | Polling (or custom) | `npm install @agenda.js/mongo-backend` |
| `@agenda.js/postgres-backend` | PostgreSQL | LISTEN/NOTIFY | `npm install @agenda.js/postgres-backend` |
| `@agenda.js/redis-backend` | Redis | Pub/Sub | `npm install @agenda.js/redis-backend` |

**MongoDB:**
```typescript
import { Agenda } from 'agenda';
import { MongoBackend } from '@agenda.js/mongo-backend';

const agenda = new Agenda({
  backend: new MongoBackend({
    address: 'mongodb://localhost/agenda'
  })
});
```

**PostgreSQL:**
```typescript
import { Agenda } from 'agenda';
import { PostgresBackend } from '@agenda.js/postgres-backend';

const agenda = new Agenda({
  backend: new PostgresBackend({
    connectionString: 'postgresql://user:pass@localhost:5432/mydb'
  })
});
```

**Redis:**
```typescript
import { Agenda } from 'agenda';
import { RedisBackend } from '@agenda.js/redis-backend';

const agenda = new Agenda({
  backend: new RedisBackend({
    connectionString: 'redis://localhost:6379'
  })
});
```

If you need a different database (SQLite, MySQL, etc.), continue reading to learn how to implement a custom backend.

## Architecture

A backend provides:
- **Storage** (required): Via `IJobRepository` interface
- **Notifications** (optional): Via `INotificationChannel` interface

### Backend Capabilities

| Backend | Storage | Notifications | Notes |
|---------|:-------:|:-------------:|-------|
| **MongoDB** (`MongoBackend`) | ✅ | ❌ | Storage only. Combine with external notification channel for real-time. |
| **PostgreSQL** (`PostgresBackend`) | ✅ | ✅ | Full backend. Uses LISTEN/NOTIFY for notifications. |
| **Redis** (`RedisBackend`) | ✅ | ✅ | Full backend. Uses Pub/Sub for notifications. |
| **InMemoryNotificationChannel** | ❌ | ✅ | Notifications only. For single-process/testing. |

### Common Configurations

1. **MongoDB only** (default): Storage with polling-based job processing
2. **MongoDB + Redis notifications**: MongoDB for storage, Redis Pub/Sub for real-time notifications
3. **MongoDB + PostgreSQL notifications**: MongoDB for storage, PostgreSQL LISTEN/NOTIFY for notifications
4. **PostgreSQL unified**: Single backend providing both storage AND notifications
5. **Redis unified**: Single backend providing both storage AND notifications

### Mixing Storage and Notification Backends

You can use MongoDB for storage while using a different system for real-time notifications:

```typescript
import { Agenda } from 'agenda';
import { MongoBackend } from '@agenda.js/mongo-backend';
import { RedisBackend } from '@agenda.js/redis-backend';

// MongoDB for storage + Redis for real-time notifications
const redisBackend = new RedisBackend({ connectionString: 'redis://localhost:6379' });
const agenda = new Agenda({
  backend: new MongoBackend({ mongo: db }),
  notificationChannel: redisBackend.notificationChannel
});
```

This is useful when you want MongoDB's proven durability and flexible queries for job storage, but need faster real-time notifications across multiple processes.

## MongoDB Backend

For MongoDB, use the `@agenda.js/mongo-backend` package:

```typescript
import { Agenda } from 'agenda';
import { MongoBackend } from '@agenda.js/mongo-backend';

// Via connection string
const agenda = new Agenda({
  backend: new MongoBackend({ address: 'mongodb://localhost/agenda' })
});

// Via existing MongoDB connection
import { MongoClient } from 'mongodb';
const client = await MongoClient.connect('mongodb://localhost');
const agenda = new Agenda({
  backend: new MongoBackend({ mongo: client.db('agenda') })
});
```

## Custom Backend

To use a different database, implement the `IAgendaBackend` interface:

```typescript
import { Agenda, IAgendaBackend, IJobRepository, INotificationChannel } from 'agenda';

class PostgresBackend implements IAgendaBackend {
  readonly repository: IJobRepository;
  readonly notificationChannel?: INotificationChannel;

  constructor(config: { connectionString: string }) {
    this.repository = new PostgresRepository(config);
    // Optional: provide LISTEN/NOTIFY based notifications
    this.notificationChannel = new PostgresNotificationChannel(config);
  }

  async connect(): Promise<void> {
    // Connect to PostgreSQL
  }

  async disconnect(): Promise<void> {
    // Disconnect from PostgreSQL
  }
}

const agenda = new Agenda({
  backend: new PostgresBackend({ connectionString: 'postgres://...' })
});
```

## IAgendaBackend Interface

```typescript
interface IAgendaBackend {
  /**
   * The job repository for storage operations.
   * Required - every backend must provide storage.
   */
  readonly repository: IJobRepository;

  /**
   * Optional notification channel for real-time job notifications.
   * If provided, Agenda will use this for immediate job processing.
   * If not provided, Agenda falls back to periodic polling.
   */
  readonly notificationChannel?: INotificationChannel;

  /**
   * Connect to the backend.
   * Called when Agenda is initialized.
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the backend.
   * Called when agenda.stop() is invoked.
   */
  disconnect(): Promise<void>;
}
```

## IJobRepository Interface

The `IJobRepository` interface defines all database operations required by Agenda:

```typescript
interface IJobRepository {
  /**
   * Connect to the database
   */
  connect(): Promise<void>;

  /**
   * Query jobs with filtering, pagination, and state computation
   */
  queryJobs(options?: IJobsQueryOptions): Promise<IJobsResult>;

  /**
   * Get overview statistics for all job types
   */
  getJobsOverview(): Promise<IJobsOverview[]>;

  /**
   * Get all distinct job names
   */
  getDistinctJobNames(): Promise<string[]>;

  /**
   * Get a single job by ID
   */
  getJobById(id: string): Promise<IJobParameters | null>;

  /**
   * Get count of jobs ready to run (nextRunAt < now)
   */
  getQueueSize(): Promise<number>;

  /**
   * Remove jobs matching the given options
   * @returns Number of jobs removed
   */
  removeJobs(options: IRemoveJobsOptions): Promise<number>;

  /**
   * Save a job (insert or update)
   */
  saveJob<DATA = unknown>(job: IJobParameters<DATA>): Promise<IJobParameters<DATA>>;

  /**
   * Update job state fields (lockedAt, lastRunAt, progress, etc.)
   */
  saveJobState(job: IJobParameters): Promise<void>;

  /**
   * Attempt to lock a job for processing
   * @returns The locked job data, or undefined if lock failed
   */
  lockJob(job: IJobParameters): Promise<IJobParameters | undefined>;

  /**
   * Unlock a single job
   */
  unlockJob(job: IJobParameters): Promise<void>;

  /**
   * Unlock multiple jobs by ID
   */
  unlockJobs(jobIds: (JobId | string)[]): Promise<void>;

  /**
   * Find and lock the next job to run for a given job type
   */
  getNextJobToRun(
    jobName: string,
    nextScanAt: Date,
    lockDeadline: Date,
    now?: Date
  ): Promise<IJobParameters | undefined>;
}
```

## INotificationChannel Interface

For real-time job notifications:

```typescript
interface INotificationChannel {
  readonly state: NotificationChannelState;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribe(handler: NotificationHandler): () => void;
  publish(notification: IJobNotification): Promise<void>;
  on(event: 'stateChange' | 'error', listener: Function): this;
  off(event: 'stateChange' | 'error', listener: Function): this;
}

type NotificationChannelState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

interface IJobNotification {
  jobId: JobId;
  jobName: string;
  nextRunAt: Date | null;
  priority: number;
  timestamp: Date;
  source?: string;
}
```

## Supporting Types

### JobId

A branded string type for job IDs:

```typescript
type JobId = string & { readonly __brand: 'AgendaJobId' };

// Convert a string to JobId
import { toJobId } from 'agenda';
const id = toJobId('my-job-id');
```

### IRemoveJobsOptions

Options for removing jobs:

```typescript
interface IRemoveJobsOptions {
  /** Remove job by ID */
  id?: JobId | string;
  /** Remove jobs by IDs */
  ids?: (JobId | string)[];
  /** Remove jobs by name */
  name?: string;
  /** Remove jobs by names (include) */
  names?: string[];
  /** Remove jobs NOT matching these names (exclude) */
  notNames?: string[];
  /** Remove jobs matching data */
  data?: unknown;
}
```

### IJobsQueryOptions

Options for querying jobs:

```typescript
interface IJobsQueryOptions {
  /** Filter by job name */
  name?: string;
  /** Filter by job names (multiple) */
  names?: string[];
  /** Filter by computed state */
  state?: JobState;
  /** Filter by job ID */
  id?: string;
  /** Filter by job IDs (multiple) */
  ids?: string[];
  /** Text to search in job name */
  search?: string;
  /** Filter by job data */
  data?: unknown;
  /** Include disabled jobs (default: true) */
  includeDisabled?: boolean;
  /** Sort order */
  sort?: IJobsSort;
  /** Number of jobs to skip (pagination) */
  skip?: number;
  /** Maximum number of jobs to return */
  limit?: number;
}
```

### JobState

Computed job states:

```typescript
type JobState = 'running' | 'scheduled' | 'queued' | 'completed' | 'failed' | 'repeating';
```

## Implementation Notes

When implementing a custom backend:

1. **Job IDs**: Use `JobId` (a branded string) for all job identifiers. Convert from your database's native ID format at the repository boundary.

2. **State Computation**: Job states are computed from job fields, not stored. Use the `computeJobState()` helper:
   ```typescript
   import { computeJobState } from 'agenda';
   const state = computeJobState(job);
   ```

3. **Locking**: Implement atomic lock operations to prevent duplicate job execution in distributed environments.

4. **Upserts**: The `saveJob()` method must handle both inserts (no `_id`) and updates (has `_id`), as well as `unique` constraints and `type: 'single'` jobs.

5. **Notifications**: If your database supports real-time notifications (like PostgreSQL LISTEN/NOTIFY), implement `INotificationChannel` and provide it via `notificationChannel`.

## Example: SQLite Backend

Here's an example structure for implementing a SQLite backend:

```typescript
import {
  IAgendaBackend,
  IJobRepository,
  BaseNotificationChannel,
  IJobNotification
} from 'agenda';

class SQLiteRepository implements IJobRepository {
  // Implement all repository methods using better-sqlite3 or similar...
}

// Optional: For multi-process setups, implement a notification channel
class SQLiteNotificationChannel extends BaseNotificationChannel {
  // Could use file-based notifications, IPC, or external pub/sub
  async connect(): Promise<void> {
    this.setState('connected');
  }

  async disconnect(): Promise<void> {
    this.setState('disconnected');
  }

  async publish(notification: IJobNotification): Promise<void> {
    // Publish notification to other processes
  }
}

class SQLiteBackend implements IAgendaBackend {
  readonly repository: IJobRepository;
  readonly notificationChannel?: INotificationChannel;

  constructor(config: { path: string }) {
    this.repository = new SQLiteRepository(config);
    // Notification channel is optional for single-process apps
  }

  async connect(): Promise<void> {
    await this.repository.connect();
  }

  async disconnect(): Promise<void> {
    // Close database connection
  }
}

// Usage
const agenda = new Agenda({
  backend: new SQLiteBackend({ path: './jobs.db' })
});
```

## Reference Implementations

For complete implementation examples, see the source code of the official backend packages:

- **MongoDB**: [@agenda.js/mongo-backend](https://github.com/agenda/agenda/tree/main/packages/mongo-backend)
- **PostgreSQL**: [@agenda.js/postgres-backend](https://github.com/agenda/agenda/tree/main/packages/postgres-backend)
- **Redis**: [@agenda.js/redis-backend](https://github.com/agenda/agenda/tree/main/packages/redis-backend)
