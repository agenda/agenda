# Custom Database Driver

Agenda v6 introduces a database-agnostic repository interface (`IJobRepository`), allowing you to use databases other than MongoDB.

## Default Driver

By default, Agenda uses MongoDB via the built-in `JobDbRepository`. You can configure it using:

```typescript
import { Agenda } from 'agenda';

// Via connection string
const agenda = new Agenda({
  db: { address: 'mongodb://localhost/agenda' }
});

// Via existing MongoDB connection
import { MongoClient } from 'mongodb';
const client = await MongoClient.connect('mongodb://localhost');
const agenda = new Agenda({
  mongo: client.db('agenda')
});
```

## Custom Database Driver

To use a different database, implement the `IJobRepository` interface and pass it to Agenda:

```typescript
import { Agenda, IJobRepository } from 'agenda';

class PostgresRepository implements IJobRepository {
  // Implement all required methods...
}

const agenda = new Agenda({
  repository: new PostgresRepository()
});
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

When implementing a custom repository:

1. **Job IDs**: Use `JobId` (a branded string) for all job identifiers. Convert from your database's native ID format at the repository boundary.

2. **State Computation**: Job states are computed from job fields, not stored. Use the `computeJobState()` helper:
   ```typescript
   import { computeJobState } from 'agenda';
   const state = computeJobState(job);
   ```

3. **Locking**: Implement atomic lock operations to prevent duplicate job execution in distributed environments.

4. **Connection**: The `connect()` method should establish the database connection and emit a `'ready'` event when complete.

5. **Upserts**: The `saveJob()` method must handle both inserts (no `_id`) and updates (has `_id`), as well as `unique` constraints and `type: 'single'` jobs.

## Example: In-Memory Repository (for testing)

```typescript
import {
  IJobRepository,
  IJobParameters,
  IJobsQueryOptions,
  IJobsResult,
  IJobsOverview,
  IRemoveJobsOptions,
  JobId,
  toJobId,
  computeJobState
} from 'agenda';

class InMemoryRepository implements IJobRepository {
  private jobs: Map<string, IJobParameters> = new Map();
  private idCounter = 0;

  async connect(): Promise<void> {
    // No-op for in-memory
  }

  async saveJob<DATA>(job: IJobParameters<DATA>): Promise<IJobParameters<DATA>> {
    if (!job._id) {
      job._id = toJobId(String(++this.idCounter));
    }
    this.jobs.set(job._id, job as IJobParameters);
    return job;
  }

  async getJobById(id: string): Promise<IJobParameters | null> {
    return this.jobs.get(id) || null;
  }

  async queryJobs(options: IJobsQueryOptions = {}): Promise<IJobsResult> {
    let jobs = Array.from(this.jobs.values());

    if (options.name) {
      jobs = jobs.filter(j => j.name === options.name);
    }

    const now = new Date();
    const jobsWithState = jobs.map(job => ({
      ...job,
      _id: job._id!,
      state: computeJobState(job, now)
    }));

    if (options.state) {
      return {
        jobs: jobsWithState.filter(j => j.state === options.state),
        total: jobsWithState.length
      };
    }

    return { jobs: jobsWithState, total: jobs.length };
  }

  // ... implement remaining methods
}
```
