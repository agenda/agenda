# Custom Backend Driver

Agenda v6 introduces a pluggable backend system (`IAgendaBackend`), allowing you to use databases other than MongoDB and optionally provide real-time notifications.

## Architecture

A backend provides:
- **Storage** (required): Via `IJobRepository` interface
- **Notifications** (optional): Via `INotificationChannel` interface

This allows:
1. **MongoDB only** (default): Storage with polling-based job processing
2. **MongoDB + Redis**: MongoDB for storage, Redis pub/sub for real-time notifications
3. **PostgreSQL with LISTEN/NOTIFY**: Single backend providing both storage AND notifications

## Default Backend: MongoBackend

By default, Agenda uses MongoDB via the built-in `MongoBackend`:

```typescript
import { Agenda, MongoBackend } from 'agenda';

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

## Example: PostgreSQL Backend with LISTEN/NOTIFY

```typescript
import {
  IAgendaBackend,
  IJobRepository,
  INotificationChannel,
  BaseNotificationChannel,
  IJobNotification
} from 'agenda';

class PostgresRepository implements IJobRepository {
  // Implement all repository methods...
}

class PostgresNotificationChannel extends BaseNotificationChannel {
  async connect(): Promise<void> {
    // Subscribe to LISTEN notifications
    this.setState('connected');
  }

  async disconnect(): Promise<void> {
    // UNLISTEN
    this.setState('disconnected');
  }

  async publish(notification: IJobNotification): Promise<void> {
    // NOTIFY with job data
  }
}

class PostgresBackend implements IAgendaBackend {
  readonly repository: IJobRepository;
  readonly notificationChannel: INotificationChannel;

  constructor(config: { connectionString: string }) {
    this.repository = new PostgresRepository(config);
    this.notificationChannel = new PostgresNotificationChannel(config);
  }

  async connect(): Promise<void> {
    await this.repository.connect();
    await this.notificationChannel.connect();
  }

  async disconnect(): Promise<void> {
    await this.notificationChannel.disconnect();
    // Close database connection
  }
}

// Usage
const agenda = new Agenda({
  backend: new PostgresBackend({ connectionString: 'postgres://...' })
});
```
