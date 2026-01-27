# Agenda

<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/agenda/agenda@main/agenda.svg" alt="Agenda" width="100" height="100">
</p>

<p align="center">
  A light-weight job scheduling library for Node.js
</p>

> **Migrating from v5?** See the [Migration Guide](docs/migration-guide-v6.md) for all breaking changes.

## What's New in v6

- **ESM-only** - Modern ES modules (Node.js 18+)
- **Pluggable backend system** - New `IAgendaBackend` interface for storage and notifications
- **Real-time notifications** - Optional notification channels for instant job processing
- **MongoDB 6 driver** - Updated to latest MongoDB driver
- **Monorepo** - Now includes `agenda`, `agendash`, and `agenda-rest` packages

## Key Features

- Complete rewrite in TypeScript (fully typed!)
- **Pluggable backend** - MongoDB by default, implement your own (see [Custom Backend Driver](docs/custom-database-driver.md))
- **Real-time notifications** - Use Redis, PostgreSQL LISTEN/NOTIFY, or custom pub/sub
- MongoDB 6 driver support
- `touch()` with optional progress parameter (0-100)
- `getRunningStats()` for monitoring
- Fork mode for sandboxed job execution
- Automatic connection handling
- Creates indexes automatically by default

# Agenda offers

- Minimal overhead. Agenda aims to keep its code base small.
- Mongo backed persistence layer.
- Promises based API.
- Scheduling with configurable priority, concurrency, repeating and persistence of job results.
- Scheduling via cron or human readable syntax.
- Event backed job queue that you can hook into.
- [Agenda-rest](https://github.com/agenda/agenda-rest): optional standalone REST API.
- [Inversify-agenda](https://github.com/lautarobock/inversify-agenda) - Some utilities for the development of agenda workers with Inversify.
- [Agendash](https://github.com/agenda/agendash): optional standalone web-interface.

### Feature Comparison

Since there are a few job queue solutions, here a table comparing them to help you use the one that
better suits your needs.

| Feature                    |     BullMQ      |      Bull       |   Bee    |       pg-boss       |         Agenda          |
| :------------------------- | :-------------: | :-------------: | :------: | :-----------------: | :---------------------: |
| Backend                    |      redis      |      redis      |  redis   |      postgres       | mongo, postgres, redis  |
| Status                     |     Active      |   Maintenance   |  Stale   |       Active        |         Active          |
| TypeScript                 |        ✓        |                 |          |          ✓          |            ✓            |
| Priorities                 |        ✓        |        ✓        |          |          ✓          |            ✓            |
| Concurrency                |        ✓        |        ✓        |    ✓     |          ✓          |            ✓            |
| Delayed jobs               |        ✓        |        ✓        |          |          ✓          |            ✓            |
| Global events              |        ✓        |        ✓        |          |                     |            ✓            |
| Rate Limiter               |        ✓        |        ✓        |          |          ✓          |                         |
| Debouncing                 |        ✓        |                 |          |          ✓          |            ✓            |
| Pause/Resume               |        ✓        |        ✓        |          |                     |            ✓            |
| Sandboxed worker           |        ✓        |        ✓        |          |                     |            ✓            |
| Repeatable jobs            |        ✓        |        ✓        |          |          ✓          |            ✓            |
| Auto-retry with backoff    |        ✓        |        ✓        |          |          ✓          |            ✓            |
| Dead letter queues         |        ✓        |        ✓        |          |          ✓          |                         |
| Job dependencies           |        ✓        |                 |          |                     |                         |
| Atomic ops                 |        ✓        |        ✓        |    ✓     |          ✓          |            ~            |
| Persistence                |        ✓        |        ✓        |    ✓     |          ✓          |            ✓            |
| UI                         |        ✓        |        ✓        |          |                     |            ✓            |
| REST API                   |                 |                 |          |                     |            ✓            |
| Central (Scalable) Queue   |        ✓        |                 |          |          ✓          |            ✓            |
| Supports long running jobs |                 |                 |          |                     |            ✓            |
| Human-readable intervals   |                 |                 |          |                     |            ✓            |
| Real-time notifications    |        ✓        |                 |          |          ✓          |            ✓            |
| Optimized for              | Jobs / Messages | Jobs / Messages | Messages |        Jobs         |          Jobs           |

_Kudos for making the comparison chart goes to [Bull](https://www.npmjs.com/package/bull#feature-comparison) maintainers._

# Installation

Install via NPM

    npm install agenda

**For MongoDB:** Install the official MongoDB backend:

    npm install @agendajs/mongo-backend

You will need a working [MongoDB](https://www.mongodb.com/) database (v4+).

**For PostgreSQL:** Install the official PostgreSQL backend:

    npm install @agendajs/postgres-backend

**For Redis:** Install the official Redis backend:

    npm install @agendajs/redis-backend

# Example Usage

```js
import { Agenda } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';

const mongoConnectionString = 'mongodb://127.0.0.1/agenda';

const agenda = new Agenda({
	backend: new MongoBackend({ address: mongoConnectionString })
});

// Or override the default collection name:
// const agenda = new Agenda({
//   backend: new MongoBackend({ address: mongoConnectionString, collection: 'jobCollectionName' })
// });

// or pass in an existing mongodb-native Db instance
// const agenda = new Agenda({
//   backend: new MongoBackend({ mongo: myMongoDb })
// });

agenda.define('delete old users', async job => {
	await User.remove({ lastLogIn: { $lt: twoDaysAgo } });
});

(async function () {
	// IIFE to give access to async/await
	await agenda.start();

	await agenda.every('3 minutes', 'delete old users');

	// Alternatively, you could also do:
	await agenda.every('*/3 * * * *', 'delete old users');
})();
```

```js
agenda.define(
	'send email report',
	async job => {
		const { to } = job.attrs.data;
		await emailClient.send({
			to,
			from: 'example@example.com',
			subject: 'Email Report',
			body: '...'
		});
	},
	{ priority: 'high', concurrency: 10 }
);

(async function () {
	await agenda.start();
	await agenda.schedule('in 20 minutes', 'send email report', { to: 'admin@example.com' });
})();
```

```js
(async function () {
	const weeklyReport = agenda.create('send email report', { to: 'example@example.com' });
	await agenda.start();
	await weeklyReport.repeatEvery('1 week').save();
})();
```

# Full documentation

See also https://agenda.github.io/agenda/

Agenda's basic control structure is an instance of an agenda. Agenda's are
mapped to a database collection and load the jobs from within.

## Table of Contents

- [Migration Guide (v5 to v6)](docs/migration-guide-v6.md)
- [Configuring an agenda](#configuring-an-agenda)
  - [Real-Time Notifications](#real-time-notifications)
- [Agenda Events](#agenda-events)
- [Defining job processors](#defining-job-processors)
- [Automatic Retry with Backoff](#automatic-retry-with-backoff)
- [Job Debouncing](#job-debouncing)
- [Creating jobs](#creating-jobs)
- [Managing jobs](#managing-jobs)
- [Starting the job processor](#starting-the-job-processor)
- [Multiple job processors](#multiple-job-processors)
- [Manually working with jobs](#manually-working-with-a-job)
- [Job Queue Events](#job-queue-events)
- [Frequently asked questions](#frequently-asked-questions)
- [Example Project structure](#example-project-structure)
- [Known Issues](#known-issues)
- [Debugging Issues](#debugging-issues)
- [Acknowledgements](#acknowledgements)

## Configuring an agenda

Possible agenda config options:

```ts
{
	// Required: Backend for storage (and optionally notifications)
	backend: IAgendaBackend;
	// Optional: Override notification channel from backend
	notificationChannel?: INotificationChannel;
	// Agenda instance name (used in lastModifiedBy field)
	name?: string;
	// Job processing options
	defaultConcurrency?: number;
	processEvery?: string | number;
	maxConcurrency?: number;
	defaultLockLimit?: number;
	lockLimit?: number;
	defaultLockLifetime?: number;
	// Fork mode options
	forkHelper?: { path: string; options?: ForkOptions };
	forkedWorker?: boolean;
}
```

**MongoBackend config options:**

```ts
{
	// MongoDB connection string
	address?: string;
	// Or existing MongoDB database instance
	mongo?: Db;
	// Collection name (default: 'agendaJobs')
	collection?: string;
	// MongoDB client options
	options?: MongoClientOptions;
	// Create indexes on connect (default: true)
	ensureIndex?: boolean;
	// Sort order for job queries
	sort?: { [key: string]: SortDirection };
	// Name for lastModifiedBy field
	name?: string;
}
```

Agenda uses [Human Interval](https://github.com/agenda/human-interval) for specifying the intervals. It supports the following units:

`seconds`, `minutes`, `hours`, `days`,`weeks`, `months` -- assumes 30 days, `years` -- assumes 365 days

More sophisticated examples

```js
agenda.processEvery('one minute');
agenda.processEvery('1.5 minutes');
agenda.processEvery('3 days and 4 hours');
agenda.processEvery('3 days, 4 hours and 36 seconds');
```

### Backend Configuration

Agenda uses a pluggable backend system. The backend provides storage and optionally real-time notifications.

**Using MongoBackend:**

```js
import { Agenda } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';

// Via connection string
const agenda = new Agenda({
	backend: new MongoBackend({ address: 'mongodb://localhost:27017/agenda-test' })
});

// Via existing MongoDB connection
const agenda = new Agenda({
	backend: new MongoBackend({ mongo: mongoClientInstance.db('agenda-test') })
});

// With custom collection name
const agenda = new Agenda({
	backend: new MongoBackend({
		address: 'mongodb://localhost:27017/agenda-test',
		collection: 'myJobs'
	})
});
```

**Using PostgresBackend:**

```bash
npm install @agendajs/postgres-backend
```

```js
import { Agenda } from 'agenda';
import { PostgresBackend } from '@agendajs/postgres-backend';

const agenda = new Agenda({
	backend: new PostgresBackend({
		connectionString: 'postgresql://user:pass@localhost:5432/mydb'
	})
});
// PostgresBackend provides both storage AND real-time notifications via LISTEN/NOTIFY
```

**Using RedisBackend:**

```bash
npm install @agendajs/redis-backend
```

```js
import { Agenda } from 'agenda';
import { RedisBackend } from '@agendajs/redis-backend';

const agenda = new Agenda({
	backend: new RedisBackend({
		connectionString: 'redis://localhost:6379'
	})
});
// RedisBackend provides both storage AND real-time notifications via Pub/Sub
```

**Custom backend:**

You can implement a custom backend by implementing the `IAgendaBackend` interface. See [Custom Database Driver](docs/custom-database-driver.md) for details.

```js
const agenda = new Agenda({ backend: myCustomBackend });
```

Agenda will emit a `ready` event (see [Agenda Events](#agenda-events)) when properly connected to the backend.
It is safe to call `agenda.start()` without waiting for this event, as this is handled internally.

### Real-Time Notifications

By default, Agenda uses periodic polling (controlled by `processEvery`) to check for new jobs. For faster job processing in distributed environments, you can configure a notification channel that triggers immediate job processing when jobs are created or updated.

**Using the built-in InMemoryNotificationChannel (single process):**

```js
import { Agenda, InMemoryNotificationChannel } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';

const agenda = new Agenda({
	backend: new MongoBackend({ mongo: db }),
	processEvery: '30 seconds', // Fallback polling interval
	notificationChannel: new InMemoryNotificationChannel()
});
```

**Using the fluent API:**

```js
const channel = new InMemoryNotificationChannel();
const agenda = new Agenda({ backend: new MongoBackend({ mongo: db }) })
	.notifyVia(channel);
```

The `InMemoryNotificationChannel` is useful for testing and single-process deployments. For multi-process or distributed deployments, you can implement custom notification channels using Redis pub/sub, PostgreSQL LISTEN/NOTIFY, or other messaging systems.

**Unified backend with notifications:**

A backend can provide both storage AND notifications. For example, a PostgreSQL backend could use LISTEN/NOTIFY:

```js
// PostgresBackend implements both repository and notificationChannel
const agenda = new Agenda({
	backend: new PostgresBackend({ connectionString: 'postgres://...' })
	// No need for separate notificationChannel - PostgresBackend provides it!
});
```

**Mixing backends (storage from one system, notifications from another):**

```js
// MongoDB for storage, Redis for notifications
const agenda = new Agenda({
	backend: new MongoBackend({ mongo: db }),
	notificationChannel: new RedisNotificationChannel({ url: 'redis://...' })
});
```

**Implementing a custom notification channel:**

Extend `BaseNotificationChannel` or implement `INotificationChannel`:

```ts
import { BaseNotificationChannel, IJobNotification } from 'agenda';

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
	}
}
```

The notification channel is automatically connected when `agenda.start()` is called and disconnected when `agenda.stop()` is called.

### name(name)

Sets the `lastModifiedBy` field to `name` in the jobs collection.
Useful if you have multiple job processors (agendas) and want to see which
job queue last ran the job.

```js
agenda.name(os.hostname + '-' + process.pid);
```

You can also specify it during instantiation

```js
const agenda = new Agenda({ name: 'test queue' });
```

### processEvery(interval)

Takes a string `interval` which can be either a traditional javascript number,
or a string such as `3 minutes`

Specifies the frequency at which agenda will query the database looking for jobs
that need to be processed. Agenda internally uses `setTimeout` to guarantee that
jobs run at (close to ~3ms) the right time.

Decreasing the frequency will result in fewer database queries, but more jobs
being stored in memory.

Also worth noting is that if the job queue is shutdown, any jobs stored in memory
that haven't run will still be locked, meaning that you may have to wait for the
lock to expire. By default it is `'5 seconds'`.

```js
agenda.processEvery('1 minute');
```

You can also specify it during instantiation

```js
const agenda = new Agenda({ processEvery: '30 seconds' });
```

### maxConcurrency(number)

Takes a `number` which specifies the max number of jobs that can be running at
any given moment. By default it is `20`.

```js
agenda.maxConcurrency(20);
```

You can also specify it during instantiation

```js
const agenda = new Agenda({ maxConcurrency: 20 });
```

### defaultConcurrency(number)

Takes a `number` which specifies the default number of a specific job that can be running at
any given moment. By default it is `5`.

```js
agenda.defaultConcurrency(5);
```

You can also specify it during instantiation

```js
const agenda = new Agenda({ defaultConcurrency: 5 });
```

### lockLimit(number)

Takes a `number` which specifies the max number jobs that can be locked at any given moment. By default it is `0` for no max.

```js
agenda.lockLimit(0);
```

You can also specify it during instantiation

```js
const agenda = new Agenda({ lockLimit: 0 });
```

### defaultLockLimit(number)

Takes a `number` which specifies the default number of a specific job that can be locked at any given moment. By default it is `0` for no max.

```js
agenda.defaultLockLimit(0);
```

You can also specify it during instantiation

```js
const agenda = new Agenda({ defaultLockLimit: 0 });
```

### defaultLockLifetime(number)

Takes a `number` which specifies the default lock lifetime in milliseconds. By
default it is 10 minutes. This can be overridden by specifying the
`lockLifetime` option to a defined job.

A job will unlock if it is finished (ie. the returned Promise resolves/rejects
or `done` is specified in the params and `done()` is called) before the
`lockLifetime`. The lock is useful if the job crashes or times out.

```js
agenda.defaultLockLifetime(10000);
```

You can also specify it during instantiation

```js
const agenda = new Agenda({ defaultLockLifetime: 10000 });
```

## Agenda Events

An instance of an agenda will emit the following events:

- `ready` - called when Agenda mongo connection is successfully opened and indices created.
  If you're passing agenda an existing connection, you shouldn't need to listen for this, as `agenda.start()` will not resolve until indices have been created.
  If you're using the `db` options, or call `database`, then you may still need to listen for the `ready` event before saving jobs. `agenda.start()` will still wait for the connection to be opened.
- `error` - called when Agenda mongo connection process has thrown an error

```js
await agenda.start();
```

## Defining Job Processors

Before you can use a job, you must define its processing behavior.

### define(jobName, fn, [options])

Defines a job with the name of `jobName`. When a job of `jobName` gets run, it
will be passed to `fn(job, done)`. To maintain asynchronous behavior, you may
either provide a Promise-returning function in `fn` _or_ provide `done` as a
second parameter to `fn`. If `done` is specified in the function signature, you
must call `done()` when you are processing the job. If your function is
synchronous or returns a Promise, you may omit `done` from the signature.

`options` is an optional argument which can overwrite the defaults. It can take
the following:

- `concurrency`: `number` maximum number of that job that can be running at once (per instance of agenda)
- `lockLimit`: `number` maximum number of that job that can be locked at once (per instance of agenda)
- `lockLifetime`: `number` interval in ms of how long the job stays locked for (see [multiple job processors](#multiple-job-processors) for more info).
  A job will automatically unlock once a returned promise resolves/rejects (or if `done` is specified in the signature and `done()` is called).
- `priority`: `(lowest|low|normal|high|highest|number)` specifies the priority
  of the job. Higher priority jobs will run first. See the priority mapping
  below
- `shouldSaveResult`: `boolean` flag that specifies whether the result of the job should also be stored in the database. Defaults to false
- `backoff`: `BackoffStrategy` a function that determines retry delay on failure. See [Automatic Retry with Backoff](#automatic-retry-with-backoff) for details

Priority mapping:

```
{
  highest: 20,
  high: 10,
  normal: 0,
  low: -10,
  lowest: -20
}
```

Async Job:

```js
agenda.define('some long running job', async job => {
	const data = await doSomelengthyTask();
	await formatThatData(data);
	await sendThatData(data);
});
```

Async Job (using `done`):

```js
agenda.define('some long running job', (job, done) => {
	doSomelengthyTask(data => {
		formatThatData(data);
		sendThatData(data);
		done();
	});
});
```

Sync Job:

```js
agenda.define('say hello', job => {
	console.log('Hello!');
});
```

`define()` acts like an assignment: if `define(jobName, ...)` is called multiple times (e.g. every time your script starts), the definition in the last call will overwrite the previous one. Thus, if you `define` the `jobName` only once in your code, it's safe for that call to execute multiple times.

## Automatic Retry with Backoff

Agenda supports automatic retry with configurable backoff strategies. When a job fails, it can be automatically rescheduled based on the backoff strategy you define.

### Basic Usage

```js
import { Agenda, backoffStrategies } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';

const agenda = new Agenda({
	backend: new MongoBackend({ address: 'mongodb://localhost/agenda' })
});

// Define a job with exponential backoff
agenda.define(
	'send email',
	async job => {
		await sendEmail(job.attrs.data);
	},
	{
		backoff: backoffStrategies.exponential({
			delay: 1000,      // Start with 1 second
			maxRetries: 5,    // Retry up to 5 times
			factor: 2,        // Double the delay each time
			jitter: 0.1       // Add 10% randomness to prevent thundering herd
		})
	}
);
// Retries at: ~1s, ~2s, ~4s, ~8s, ~16s (then gives up)
```

### Built-in Backoff Strategies

Agenda provides three built-in backoff strategies:

#### Constant Backoff

Same delay between each retry attempt.

```js
import { constant } from 'agenda';

agenda.define('my-job', handler, {
	backoff: constant({
		delay: 5000,      // 5 seconds between each retry
		maxRetries: 3     // Retry up to 3 times
	})
});
// Retries at: 5s, 5s, 5s
```

#### Linear Backoff

Delay increases by a fixed amount each retry.

```js
import { linear } from 'agenda';

agenda.define('my-job', handler, {
	backoff: linear({
		delay: 1000,      // Start with 1 second
		increment: 2000,  // Add 2 seconds each retry (default: same as delay)
		maxRetries: 4,
		maxDelay: 10000   // Cap at 10 seconds
	})
});
// Retries at: 1s, 3s, 5s, 7s
```

#### Exponential Backoff

Delay multiplies by a factor each retry. Best for rate-limited APIs.

```js
import { exponential } from 'agenda';

agenda.define('my-job', handler, {
	backoff: exponential({
		delay: 100,       // Start with 100ms
		factor: 2,        // Double each time (default: 2)
		maxRetries: 5,
		maxDelay: 30000,  // Cap at 30 seconds
		jitter: 0.2       // Add 20% randomness
	})
});
// Retries at: ~100ms, ~200ms, ~400ms, ~800ms, ~1600ms
```

### Preset Strategies

For common use cases, Agenda provides preset strategies:

```js
import { backoffStrategies } from 'agenda';

// Aggressive: Fast retries for transient failures
// 100ms, 200ms, 400ms (3 retries in ~700ms)
agenda.define('quick-job', handler, {
	backoff: backoffStrategies.aggressive()
});

// Standard: Balanced approach (default recommendation)
// ~1s, ~2s, ~4s, ~8s, ~16s with 10% jitter (5 retries)
agenda.define('normal-job', handler, {
	backoff: backoffStrategies.standard()
});

// Relaxed: Gentle backoff for rate-limited APIs
// ~5s, ~15s, ~45s, ~135s with 10% jitter (4 retries)
agenda.define('api-job', handler, {
	backoff: backoffStrategies.relaxed()
});
```

### Custom Backoff Functions

You can define your own backoff logic by providing a function:

```js
agenda.define('custom-job', handler, {
	backoff: (context) => {
		// context contains: { attempt, error, jobName, jobData }

		// Return delay in milliseconds, or null to stop retrying
		if (context.attempt > 3) return null;

		// Fibonacci-like sequence
		const fibDelays = [1000, 1000, 2000, 3000, 5000];
		return fibDelays[context.attempt - 1];
	}
});
```

### Combining Strategies

Use `combine()` to chain multiple strategies:

```js
import { combine, constant, exponential } from 'agenda';

agenda.define('complex-job', handler, {
	backoff: combine(
		// First 2 retries: quick constant delay
		(ctx) => ctx.attempt <= 2 ? 100 : null,
		// Then switch to exponential
		(ctx) => {
			if (ctx.attempt > 5) return null;
			return 1000 * Math.pow(2, ctx.attempt - 3);
		}
	)
});
```

### Conditional Retry

Use `when()` to retry only for specific errors:

```js
import { when, exponential } from 'agenda';

agenda.define('api-job', handler, {
	backoff: when(
		// Only retry on timeout or rate limit errors
		(ctx) =>
			ctx.error.message.includes('timeout') ||
			ctx.error.message.includes('rate limit'),
		exponential({ delay: 1000, maxRetries: 3 })
	)
});
```

### Retry Events

Listen for retry events to monitor job behavior:

```js
// When a job is scheduled for retry
agenda.on('retry', (job, details) => {
	console.log(`Job ${job.attrs.name} retry #${details.attempt}`);
	console.log(`  Next run: ${details.nextRunAt}`);
	console.log(`  Delay: ${details.delay}ms`);
	console.log(`  Error: ${details.error.message}`);
});

// Job-specific retry event
agenda.on('retry:send email', (job, details) => {
	metrics.increment('email.retries');
});

// When all retries are exhausted
agenda.on('retry exhausted', (error, job) => {
	console.log(`Job ${job.attrs.name} failed after ${job.attrs.failCount} attempts`);
	alertOps(job, error);
});

// Job-specific exhaustion
agenda.on('retry exhausted:critical-job', (error, job) => {
	// Move to dead letter queue, send alert, etc.
});
```

### Backoff Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `delay` | number | 1000 | Initial delay in milliseconds |
| `maxRetries` | number | 3 | Maximum retry attempts |
| `maxDelay` | number | Infinity | Maximum delay cap |
| `jitter` | number | 0 | Randomness factor (0-1) |
| `factor` | number | 2 | Multiplier for exponential backoff |
| `increment` | number | delay | Amount to add for linear backoff |

### Important Notes

- **failCount tracks attempts**: Use `job.attrs.failCount` to see how many times a job has failed
- **Backoff is per-definition**: Set the backoff strategy when defining the job, not when scheduling it
- **Repeating jobs can use backoff**: If a repeating job (created with `every()`) has a backoff configured and fails, it will retry immediately rather than waiting for the next scheduled run
- **Manual retry still works**: You can still listen to `fail` events and manually reschedule if needed

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

### Basic Usage

```js
import { Agenda } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';

const agenda = new Agenda({
	backend: new MongoBackend({ address: 'mongodb://localhost/agenda' })
});

// Debounce job - execute 2s after last save
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
```

### Debounce Strategies

#### Trailing (Default)

The job executes after a quiet period. Each save resets the timer.

```js
await agenda.create('syncUserActivity', { userId: 123 })
  .unique({ 'data.userId': 123 })
  .debounce(5000)  // Wait 5s after last save
  .save();
```

#### Leading

The job executes immediately on first call. Subsequent calls within the window are ignored.

```js
await agenda.create('sendNotification', { channel: '#alerts' })
  .unique({ 'data.channel': '#alerts' })
  .debounce(60000, { strategy: 'leading' })
  .save();
// → First call executes immediately, subsequent calls within 60s are ignored
```

### maxWait Option

With trailing strategy, `maxWait` guarantees execution within a maximum time even if saves keep coming.

```js
await agenda.create('syncUserActivity', { userId: 123 })
  .unique({ 'data.userId': 123 })
  .debounce(5000, { maxWait: 30000 })
  .save();
// → Even with continuous saves, job runs within 30s
```

### Debounce Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `delay` | number | - | Debounce window in milliseconds (required, first argument) |
| `strategy` | `'trailing'` \| `'leading'` | `'trailing'` | When to execute the job |
| `maxWait` | number | - | Max time before forced execution (trailing only) |

### Requirements

- **Requires `unique()` constraint**: Debounce identifies which jobs to combine using the unique key
- **Without `unique()`**: Each save creates a new job (no debouncing occurs)
- **Persistence**: Debounce state is stored in the database, surviving process restarts

### Helper Method: nowDebounced()

For convenience, use `nowDebounced()` to create a debounced job in one call:

```js
// Equivalent to create().unique().debounce().save()
await agenda.nowDebounced(
  'updateSearchIndex',
  { entityType: 'products' },
  { 'data.entityType': 'products' },  // unique query
  { delay: 2000 }                      // debounce options
);
```

## Creating Jobs

### every(interval, name, [data], [options])

Runs job `name` at the given `interval`. Optionally, data and options can be passed in.
Every creates a job of type `single`, which means that it will only create one
job in the database, even if that line is run multiple times. This lets you put
it in a file that may get run multiple times, such as `webserver.js` which may
reboot from time to time.

`interval` can be a human-readable format `String`, a [cron format](https://www.npmjs.com/package/cron-parser) `String`, or a `Number`.

`data` is an optional argument that will be passed to the processing function
under `job.attrs.data`.

`options` is an optional argument containing:

- `timezone`: Timezone for cron expressions (e.g., `'America/New_York'`)
- `skipImmediate`: If `true`, skip the immediate first run
- `forkMode`: If `true`, run in a forked child process
- `startDate`: `Date` or string - job won't run before this date
- `endDate`: `Date` or string - job won't run after this date
- `skipDays`: Array of days to skip (0=Sunday, 1=Monday, ..., 6=Saturday)

In order to use this argument, `data` must also be specified.

Returns the `job`.

```js
agenda.define('printAnalyticsReport', async job => {
	const users = await User.doSomethingReallyIntensive();
	processUserData(users);
	console.log('I print a report!');
});

agenda.every('15 minutes', 'printAnalyticsReport');
```

**With date constraints (business hours only, weekdays):**

```js
await agenda.every('1 hour', 'business-metrics', { type: 'hourly' }, {
	startDate: new Date('2024-06-01'),
	endDate: new Date('2024-12-31'),
	skipDays: [0, 6],  // Skip weekends
	timezone: 'America/New_York'
});
```

Optionally, `name` could be array of job names, which is convenient for scheduling
different jobs for same `interval`.

```js
agenda.every('15 minutes', ['printAnalyticsReport', 'sendNotifications', 'updateUserRecords']);
```

In this case, `every` returns array of `jobs`.

### schedule(when, name, [data], [options])

Schedules a job to run `name` once at a given time. `when` can be a `Date` or a
`String` such as `tomorrow at 5pm`.

`data` is an optional argument that will be passed to the processing function
under `job.attrs.data`.

`options` is an optional argument containing:

- `startDate`: `Date` or string - job won't run before this date
- `endDate`: `Date` or string - job won't run after this date (sets `nextRunAt` to `null`)
- `skipDays`: Array of days to skip (0=Sunday, 1=Monday, ..., 6=Saturday)

Returns the `job`.

```js
agenda.schedule('tomorrow at noon', 'printAnalyticsReport', { userCount: 100 });
```

**With date constraints:**

```js
// Schedule for Saturday, but skip weekends - will run on Monday instead
await agenda.schedule('next saturday', 'weekday-task', { id: 123 }, {
	skipDays: [0, 6]  // Skip weekends
});
```

Optionally, `name` could be array of job names, similar to the `every` method.

```js
agenda.schedule('tomorrow at noon', [
	'printAnalyticsReport',
	'sendNotifications',
	'updateUserRecords'
]);
```

In this case, `schedule` returns array of `jobs`.

### now(name, [data])

Schedules a job to run `name` once immediately.

`data` is an optional argument that will be passed to the processing function
under `job.attrs.data`.

Returns the `job`.

```js
agenda.now('do the hokey pokey');
```

### create(jobName, data)

Returns an instance of a `jobName` with `data`. This does _NOT_ save the job in
the database. See below to learn how to manually work with jobs.

```js
const job = agenda.create('printAnalyticsReport', { userCount: 100 });
await job.save();
console.log('Job successfully saved');
```

## Managing Jobs

### jobs(mongodb-native query, mongodb-native sort, mongodb-native limit, mongodb-native skip)

Lets you query (then sort, limit and skip the result) all of the jobs in the agenda job's database. These are full [mongodb-native](https://github.com/mongodb/node-mongodb-native) `find`, `sort`, `limit` and `skip` commands. See mongodb-native's documentation for details.

```js
const jobs = await agenda.jobs({ name: 'printAnalyticsReport' }, { data: -1 }, 3, 1);
// Work with jobs (see below)
```

### cancel(mongodb-native query)

Cancels any jobs matching the passed mongodb-native query, and removes them from the database. Returns a Promise resolving to the number of cancelled jobs, or rejecting on error.

```js
const numRemoved = await agenda.cancel({ name: 'printAnalyticsReport' });
```

This functionality can also be achieved by first retrieving all the jobs from the database using `agenda.jobs()`, looping through the resulting array and calling `job.remove()` on each. It is however preferable to use `agenda.cancel()` for this use case, as this ensures the operation is atomic.

### disable(mongodb-native query)

Disables any jobs matching the passed mongodb-native query, preventing any matching jobs from being run by the Job Processor.

```js
const numDisabled = await agenda.disable({ name: 'pollExternalService' });
```

Similar to `agenda.cancel()`, this functionality can be acheived with a combination of `agenda.jobs()` and `job.disable()`

### enable(mongodb-native query)

Enables any jobs matching the passed mongodb-native query, allowing any matching jobs to be run by the Job Processor.

```js
const numEnabled = await agenda.enable({ name: 'pollExternalService' });
```

Similar to `agenda.cancel()`, this functionality can be acheived with a combination of `agenda.jobs()` and `job.enable()`

### purge()

Removes all jobs in the database without defined behaviors. Useful if you change a definition name and want to remove old jobs. Returns a Promise resolving to the number of removed jobs, or rejecting on error.

_IMPORTANT:_ Do not run this before you finish defining all of your jobs. If you do, you will nuke your database of jobs.

```js
const numRemoved = await agenda.purge();
```

## Starting the job processor

To get agenda to start processing jobs from the database you must start it. This
will schedule an interval (based on `processEvery`) to check for new jobs and
run them. You can also stop the queue.

### start

Starts the job queue processing, checking [`processEvery`](#processeveryinterval) time to see if there
are new jobs. Must be called _after_ `processEvery`, and _before_ any job scheduling (e.g. `every`).

### stop

Stops the job queue processing. Unlocks currently running jobs.

This can be very useful for graceful shutdowns so that currently running/grabbed jobs are abandoned so that other
job queues can grab them / they are unlocked should the job queue start again. Here is an example of how to do a graceful
shutdown.

```js
async function graceful() {
	await agenda.stop();
	process.exit(0);
}

process.on('SIGTERM', graceful);
process.on('SIGINT', graceful);
```

### drain

Waits for all currently running jobs to finish before stopping the job queue processing. Unlike `stop()`, this method does not unlock jobs - it lets them complete their work.

This is useful for graceful shutdowns where you want to ensure all in-progress work finishes before the process exits.

```js
async function graceful() {
	await agenda.drain();
	process.exit(0);
}

process.on('SIGTERM', graceful);
process.on('SIGINT', graceful);
```

**With timeout** - useful when you need to shutdown within a time limit (e.g., cloud platforms like Heroku give 30 seconds):

```js
async function graceful() {
	const result = await agenda.drain(30000); // 30 second timeout
	if (result.timedOut) {
		console.log(`Shutdown timeout: ${result.running} jobs still running`);
	}
	process.exit(0);
}
```

**With AbortSignal** - for external control over the drain operation:

```js
const controller = new AbortController();

// Abort drain after 30 seconds
setTimeout(() => controller.abort(), 30000);

const result = await agenda.drain({ signal: controller.signal });
if (result.aborted) {
	console.log(`Drain aborted: ${result.running} jobs still running`);
}
```

**DrainResult** - `drain()` returns information about what happened:

```ts
interface DrainResult {
	completed: number;  // jobs that finished during drain
	running: number;    // jobs still running (if timed out or aborted)
	timedOut: boolean;  // true if timeout was reached
	aborted: boolean;   // true if signal was aborted
}
```

**Comparison of `stop()` vs `drain()`:**

| Method | Running Jobs | New Jobs | Use Case |
|--------|--------------|----------|----------|
| `stop()` | Unlocks immediately | Stops accepting | Quick shutdown, jobs picked up by other workers |
| `drain()` | Waits for completion | Stops accepting | Graceful shutdown, ensure work finishes |

## Multiple job processors

Sometimes you may want to have multiple node instances / machines process from
the same queue. Agenda supports a locking mechanism to ensure that multiple
queues don't process the same job.

You can configure the locking mechanism by specifying `lockLifetime` as an
interval when defining the job.

```js
agenda.define(
	'someJob',
	(job, cb) => {
		// Do something in 10 seconds or less...
	},
	{ lockLifetime: 10000 }
);
```

This will ensure that no other job processor (this one included) attempts to run the job again
for the next 10 seconds. If you have a particularly long running job, you will want to
specify a longer lockLifetime.

By default it is 10 minutes. Typically you shouldn't have a job that runs for 10 minutes,
so this is really insurance should the job queue crash before the job is unlocked.

When a job is finished (i.e. the returned promise resolves/rejects or `done` is
specified in the signature and `done()` is called), it will automatically unlock.

## Manually working with a job

A job instance has many instance methods. All mutating methods must be followed
with a call to `await job.save()` in order to persist the changes to the database.

### repeatEvery(interval, [options])

Specifies an `interval` on which the job should repeat. The job runs at the time of defining as well in configured intervals, that is "run _now_ and in intervals".

`interval` can be a human-readable format `String`, a [cron format](https://www.npmjs.com/package/cron-parser) `String`, or a `Number`.

`options` is an optional argument containing:

`options.timezone`: should be a string as accepted by [moment-timezone](https://momentjs.com/timezone/) and is considered when using an interval in the cron string format.

`options.skipImmediate`: `true` | `false` (default) Setting this `true` will skip the immediate run. The first run will occur only in configured interval.

```js
job.repeatEvery('10 minutes');
await job.save();
```

```js
job.repeatEvery('3 minutes', {
	skipImmediate: true
});
await job.save();
```

```js
job.repeatEvery('0 6 * * *', {
	timezone: 'America/New_York'
});
await job.save();
```

### repeatAt(time)

Specifies a `time` when the job should repeat. [Possible values](https://github.com/matthewmueller/date#examples)

```js
job.repeatAt('3:30pm');
await job.save();
```

### schedule(time)

Specifies the next `time` at which the job should run.

```js
job.schedule('tomorrow at 6pm');
await job.save();
```

### startDate(date)

Sets the start date for the job. The job will not run before this date. If `nextRunAt` is computed to be before `startDate`, it will be adjusted to `startDate`.

```js
job.startDate(new Date('2024-06-01'));
// Or with a string
job.startDate('2024-06-01T00:00:00Z');
await job.save();
```

### endDate(date)

Sets the end date for the job. The job will not run after this date. If `nextRunAt` would be after `endDate`, it will be set to `null` and the job stops running.

```js
job.endDate(new Date('2024-12-31'));
// Or with a string
job.endDate('2024-12-31T23:59:59Z');
await job.save();
```

### skipDays(days)

Sets the days of the week to skip. The job will not run on these days. Days are specified as an array of numbers where 0 = Sunday, 1 = Monday, ..., 6 = Saturday.

```js
// Skip weekends
job.skipDays([0, 6]);
await job.save();
```

```js
// Skip Monday and Wednesday
job.skipDays([1, 3]);
await job.save();
```

**Combining date constraints:**

```js
const job = agenda.create('business-report', { type: 'daily' });
job.startDate('2024-06-01')
   .endDate('2024-12-31')
   .skipDays([0, 6])  // Skip weekends
   .repeatEvery('1 day', { timezone: 'America/New_York' });
await job.save();
```

### priority(priority)

Specifies the `priority` weighting of the job. Can be a number or a string from
the above priority table.

```js
job.priority('low');
await job.save();
```

### setShouldSaveResult(setShouldSaveResult)

Specifies whether the result of the job should also be stored in the database. Defaults to false.

```js
job.setShouldSaveResult(true);
await job.save();
```

The data returned by the job will be available on the `result` attribute after it succeeded and got retrieved again from the database, e.g. via `agenda.jobs(...)` or through the [success job event](#agenda-events)).

### unique(properties, [options])

Ensure that only one instance of this job exists with the specified properties

`options` is an optional argument which can overwrite the defaults. It can take
the following:

- `insertOnly`: `boolean` will prevent any properties from persisting if the job already exists. Defaults to false.

```js
job.unique({ 'data.type': 'active', 'data.userId': '123', nextRunAt: date });
await job.save();
```

_IMPORTANT:_ To avoid high CPU usage by MongoDB, make sure to create an index on the used fields, like `data.type` and `data.userId` for the example above.

### debounce(delay, [options])

Configures debouncing for the job. Requires a `unique()` constraint to be set. See [Job Debouncing](#job-debouncing) for detailed documentation.

`delay` is the debounce window in milliseconds.

`options` is an optional argument:
- `strategy`: `'trailing'` (default) or `'leading'` - when to execute the job
- `maxWait`: number - maximum time before forced execution (trailing only)

```js
job.unique({ 'data.userId': 123 });
job.debounce(5000);  // 5 second debounce
await job.save();

// With options
job.unique({ 'data.channel': '#alerts' });
job.debounce(60000, { strategy: 'leading' });
await job.save();
```

### fail(reason)

Sets `job.attrs.failedAt` to `now`, and sets `job.attrs.failReason` to `reason`.

Optionally, `reason` can be an error, in which case `job.attrs.failReason` will
be set to `error.message`

```js
job.fail('insufficient disk space');
// or
job.fail(new Error('insufficient disk space'));
await job.save();
```

### run(callback)

Runs the given `job` and calls `callback(err, job)` upon completion. Normally
you never need to call this manually.

```js
job.run((err, job) => {
	console.log("I don't know why you would need to do this...");
});
```

### save()

Saves the `job.attrs` into the database. Returns a Promise resolving to a Job instance, or rejecting on error.

```js
try {
	await job.save();
	cosole.log('Successfully saved job to collection');
} catch (e) {
	console.error('Error saving job to collection');
}
```

### remove()

Removes the `job` from the database. Returns a Promise resolving to the number of jobs removed, or rejecting on error.

```js
try {
	await job.remove();
	console.log('Successfully removed job from collection');
} catch (e) {
	console.error('Error removing job from collection');
}
```

### disable()

Disables the `job`. Upcoming runs won't execute.

### enable()

Enables the `job` if it got disabled before. Upcoming runs will execute.

### touch()

Resets the lock on the job. Useful to indicate that the job hasn't timed out
when you have very long running jobs. The call returns a promise that resolves
when the job's lock has been renewed.

```js
agenda.define('super long job', async job => {
	await doSomeLongTask();
	await job.touch();
	await doAnotherLongTask();
	await job.touch();
	await finishOurLongTasks();
});
```

## Job Queue Events

An instance of an agenda will emit the following events:

- `start` - called just before a job starts
- `start:job name` - called just before the specified job starts

```js
agenda.on('start', job => {
	console.log('Job %s starting', job.attrs.name);
});
```

- `complete` - called when a job finishes, regardless of if it succeeds or fails
- `complete:job name` - called when a job finishes, regardless of if it succeeds or fails

```js
agenda.on('complete', job => {
	console.log(`Job ${job.attrs.name} finished`);
});
```

- `success` - called when a job finishes successfully
- `success:job name` - called when a job finishes successfully

```js
agenda.on('success:send email', job => {
	console.log(`Sent Email Successfully to ${job.attrs.data.to}`);
});
```

- `fail` - called when a job throws an error
- `fail:job name` - called when a job throws an error

```js
agenda.on('fail:send email', (err, job) => {
	console.log(`Job failed with error: ${err.message}`);
});
```

- `retry` - called when a job is scheduled for automatic retry (requires backoff strategy)
- `retry:job name` - called when a specific job is scheduled for retry

```js
agenda.on('retry', (job, details) => {
	// details: { attempt, delay, nextRunAt, error }
	console.log(`Retrying ${job.attrs.name} in ${details.delay}ms (attempt ${details.attempt})`);
});
```

- `retry exhausted` - called when a job has exhausted all retry attempts
- `retry exhausted:job name` - called when a specific job exhausts retries

```js
agenda.on('retry exhausted:send email', (err, job) => {
	console.log(`Email job failed permanently after ${job.attrs.failCount} attempts`);
});
```

## Frequently Asked Questions

### What is the order in which jobs run?

Jobs are run with priority in a first in first out order (so they will be run in the order they were scheduled AND with respect to highest priority).

For example, if we have two jobs named "send-email" queued (both with the same priority), and the first job is queued at 3:00 PM and second job is queued at 3:05 PM with the same `priority` value, then the first job will run first if we start to send "send-email" jobs at 3:10 PM. However if the first job has a priority of `5` and the second job has a priority of `10`, then the second will run first (priority takes precedence) at 3:10 PM.

The default sort order is `{ nextRunAt: 'asc', priority: 'desc' }` and can be changed through the `sort` option when configuring the backend.

### What is the difference between `lockLimit` and `maxConcurrency`?

Agenda will lock jobs 1 by one, setting the `lockedAt` property in mongoDB, and creating an instance of the `Job` class which it caches into the `_lockedJobs` array. This defaults to having no limit, but can be managed using lockLimit. If all jobs will need to be run before agenda's next interval (set via `agenda.processEvery`), then agenda will attempt to lock all jobs.

Agenda will also pull jobs from `_lockedJobs` and into `_runningJobs`. These jobs are actively being worked on by user code, and this is limited by `maxConcurrency` (defaults to 20).

If you have multiple instances of agenda processing the same job definition with a fast repeat time you may find they get unevenly loaded. This is because they will compete to lock as many jobs as possible, even if they don't have enough concurrency to process them. This can be resolved by tweaking the `maxConcurrency` and `lockLimit` properties.

### Sample Project Structure?

Agenda doesn't have a preferred project structure and leaves it to the user to
choose how they would like to use it. That being said, you can check out the
[example project structure](#example-project-structure) below.

### Web Interface?

Agenda itself does not have a web interface built in but we do offer stand-alone web interface [Agendash](https://github.com/agenda/agendash):

<a href="https://raw.githubusercontent.com/agenda/agendash/master/job-details.png"><img src="https://raw.githubusercontent.com/agenda/agendash/master/job-details.png" style="max-width:100%" alt="Agendash interface"></a>

### Choosing a Backend

Agenda v6 supports multiple storage backends. Choose based on your infrastructure:

| Backend | Package | Best For |
|---------|---------|----------|
| **MongoDB** | Built-in (`agenda`) | Default choice, excellent for most use cases. Strong consistency, flexible queries. |
| **PostgreSQL** | `@agendajs/postgres-backend` | Teams already using PostgreSQL. LISTEN/NOTIFY provides real-time notifications without additional infrastructure. |
| **Redis** | `@agendajs/redis-backend` | High-throughput scenarios. Fast Pub/Sub notifications. Configure persistence for durability. |

**MongoDB** remains the default and most battle-tested backend. **PostgreSQL** is great when you want to consolidate on a single database. **Redis** offers the lowest latency for job notifications but requires proper persistence configuration (RDB/AOF) for durability.

#### Backend Capabilities

Each backend provides different capabilities for storage and real-time notifications:

| Backend | Storage | Notifications | Notes |
|---------|:-------:|:-------------:|-------|
| **MongoDB** (`MongoBackend`) | ✅ | ❌ | Storage only. Use with external notification channel for real-time. |
| **PostgreSQL** (`PostgresBackend`) | ✅ | ✅ | Full backend. Uses LISTEN/NOTIFY for notifications. |
| **Redis** (`RedisBackend`) | ✅ | ✅ | Full backend. Uses Pub/Sub for notifications. |
| **InMemoryNotificationChannel** | ❌ | ✅ | Notifications only. For single-process/testing. |
| **RedisNotificationChannel** | ❌ | ✅ | Notifications only. For multi-process with MongoDB storage. |

#### Mixing Storage and Notification Backends

You can combine MongoDB storage with a separate notification channel for real-time job processing:

```js
import { Agenda } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';
import { RedisBackend } from '@agendajs/redis-backend';

// MongoDB for storage + Redis for real-time notifications
const redisBackend = new RedisBackend({ connectionString: 'redis://localhost:6379' });
const agenda = new Agenda({
  backend: new MongoBackend({ mongo: db }),
  notificationChannel: redisBackend.notificationChannel
});

// Or use PostgreSQL notifications with MongoDB storage
import { PostgresBackend } from '@agendajs/postgres-backend';
const pgBackend = new PostgresBackend({ connectionString: 'postgres://...' });
const agenda = new Agenda({
  backend: new MongoBackend({ mongo: db }),
  notificationChannel: pgBackend.notificationChannel
});
```

This is useful when you want to keep MongoDB for job storage (proven durability, flexible queries) but need faster real-time notifications across multiple processes.

See [Backend Configuration](#backend-configuration) for setup details.

### Spawning / forking processes

Ultimately Agenda can work from a single job queue across multiple machines, node processes, or forks. If you are interested in having more than one worker, [Bars3s](http://github.com/bars3s) has written up a fantastic example of how one might do it:

```js
const cluster = require('cluster');
const os = require('os');

const httpServer = require('./app/http-server');
const jobWorker = require('./app/job-worker');

const jobWorkers = [];
const webWorkers = [];

if (cluster.isMaster) {
	const cpuCount = os.cpus().length;
	// Create a worker for each CPU
	for (let i = 0; i < cpuCount; i += 1) {
		addJobWorker();
		addWebWorker();
	}

	cluster.on('exit', (worker, code, signal) => {
		if (jobWorkers.indexOf(worker.id) !== -1) {
			console.log(
				`job worker ${worker.process.pid} exited (signal: ${signal}). Trying to respawn...`
			);
			removeJobWorker(worker.id);
			addJobWorker();
		}

		if (webWorkers.indexOf(worker.id) !== -1) {
			console.log(
				`http worker ${worker.process.pid} exited (signal: ${signal}). Trying to respawn...`
			);
			removeWebWorker(worker.id);
			addWebWorker();
		}
	});
} else {
	if (process.env.web) {
		console.log(`start http server: ${cluster.worker.id}`);
		// Initialize the http server here
		httpServer.start();
	}

	if (process.env.job) {
		console.log(`start job server: ${cluster.worker.id}`);
		// Initialize the Agenda here
		jobWorker.start();
	}
}

function addWebWorker() {
	webWorkers.push(cluster.fork({ web: 1 }).id);
}

function addJobWorker() {
	jobWorkers.push(cluster.fork({ job: 1 }).id);
}

function removeWebWorker(id) {
	webWorkers.splice(webWorkers.indexOf(id), 1);
}

function removeJobWorker(id) {
	jobWorkers.splice(jobWorkers.indexOf(id), 1);
}
```

### Recovering lost Mongo connections ("auto_reconnect")

Agenda is configured by default to automatically reconnect indefinitely, emitting an [error event](#agenda-events)
when no connection is available on each [process tick](#processeveryinterval), allowing you to restore the Mongo
instance without having to restart the application.

However, if you are using an [existing Mongo client](#mongomongoclientinstance)
you'll need to configure the `reconnectTries` and `reconnectInterval` [connection settings](http://mongodb.github.io/node-mongodb-native/3.0/reference/connecting/connection-settings/)
manually, otherwise you'll find that Agenda will throw an error with the message "MongoDB connection is not recoverable,
application restart required" if the connection cannot be recovered within 30 seconds.

# Example Project Structure

Agenda will only process jobs that it has definitions for. This allows you to
selectively choose which jobs a given agenda will process.

Consider the following project structure, which allows us to share models with
the rest of our code base, and specify which jobs a worker processes, if any at
all.

```
- server.js
- worker.js
lib/
  - agenda.js
  controllers/
    - user-controller.js
  jobs/
    - email.js
    - video-processing.js
    - image-processing.js
   models/
     - user-model.js
     - blog-post.model.js
```

Sample job processor (eg. `jobs/email.js`)

```js
let email = require('some-email-lib'),
	User = require('../models/user-model.js');

module.exports = function (agenda) {
	agenda.define('registration email', async job => {
		const user = await User.get(job.attrs.data.userId);
		await email(user.email(), 'Thanks for registering', 'Thanks for registering ' + user.name());
	});

	agenda.define('reset password', async job => {
		// Etc
	});

	// More email related jobs
};
```

lib/agenda.js

```js
import { Agenda } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';

const agenda = new Agenda({
	backend: new MongoBackend({
		address: 'mongodb://localhost:27017/agenda-test',
		collection: 'agendaJobs'
	})
});

const jobTypes = process.env.JOB_TYPES ? process.env.JOB_TYPES.split(',') : [];

jobTypes.forEach(type => {
	require('./jobs/' + type)(agenda);
});

if (jobTypes.length) {
	agenda.start(); // Returns a promise, which should be handled appropriately
}

module.exports = agenda;
```

lib/controllers/user-controller.js

```js
let app = express(),
	User = require('../models/user-model'),
	agenda = require('../worker.js');

app.post('/users', (req, res, next) => {
	const user = new User(req.body);
	user.save(err => {
		if (err) {
			return next(err);
		}
		agenda.now('registration email', { userId: user.primary() });
		res.send(201, user.toJson());
	});
});
```

worker.js

```js
require('./lib/agenda.js');
```

Now you can do the following in your project:

```bash
node server.js
```

Fire up an instance with no `JOB_TYPES`, giving you the ability to process jobs,
but not wasting resources processing jobs.

```bash
JOB_TYPES=email node server.js
```

Allow your http server to process email jobs.

```bash
JOB_TYPES=email node worker.js
```

Fire up an instance that processes email jobs.

```bash
JOB_TYPES=video-processing,image-processing node worker.js
```

Fire up an instance that processes video-processing/image-processing jobs. Good for a heavy hitting server.

# Debugging Issues

If you think you have encountered a bug, please feel free to report it here:

[Submit Issue](https://github.com/agenda/agenda/issues/new)

Please provide us with as much details as possible such as:

- Agenda version
- Environment (OSX, Linux, Windows, etc)
- Small description of what happened
- Any relevant stack track
- Agenda logs (see below)

#### To turn on logging, please set your DEBUG env variable like so:

- OSX: `DEBUG="agenda:*" ts-node src/index.ts`
- Linux: `DEBUG="agenda:*" ts-node src/index.ts`
- Windows CMD: `set DEBUG=agenda:*`
- Windows PowerShell: `$env:DEBUG = "agenda:*"`

While not necessary, attaching a text file with this debug information would
be extremely useful in debugging certain issues and is encouraged.

# Known Issues

# Performance

Performance tuning is backend-specific. See the documentation for your backend:

- **MongoDB**: See [@agendajs/mongo-backend](https://www.npmjs.com/package/@agendajs/mongo-backend) for index recommendations
- **PostgreSQL**: See [@agendajs/postgres-backend](https://www.npmjs.com/package/@agendajs/postgres-backend) - indexes are created automatically by default
- **Redis**: See [@agendajs/redis-backend](https://www.npmjs.com/package/@agendajs/redis-backend)

# Sandboxed Worker - use child processes

It's possible to start jobs in a child process, this helps for example for long running processes
to seperate them from the main thread. For example if one process consumes too much memory and gets killed,
it will not affect any others.
To use this feature, several steps are required.
1.) create a childWorker helper.
The subrocess has a complete seperate context, so there are no database connections or anything else that can be shared.
Therefore you have to ensure that all required connections and initializations are done here too. Furthermore
you also have to load the correct job definition so that agenda nows what code it must execute. Therefore 3 parameters
are passed to the childWorker: name, jobId and path to the job definition.

Example file can look like this:

childWorker.ts

```ts
import 'reflect-metadata';

process.on('message', message => {
  if (message === 'cancel') {
    process.exit(2);
  } else {
    console.log('got message', message);
  }
});

(async () => {
	const mongooseConnection = await connectToDatabase(); // connect to database

  // do other required initializations

  // get process arguments (name, jobId and path to agenda definition file)
	const [, , name, jobId, agendaDefinition] = process.argv;

  // set fancy process title
	process.title = `${process.title} (sub worker: ${name}/${jobId})`;

  // initialize Agenda in "forkedWorker" mode
	const agenda = new Agenda({
		name: `subworker-${name}`,
		forkedWorker: true,
		mongo: mongooseConnection.db as any
	});
	// wait for db connection
	await agenda.ready;

	if (!name || !jobId) {
		throw new Error(`invalid parameters: ${JSON.stringify(process.argv)}`);
	}

  // load job definition
  /** in this case the file is for example ../some/path/definitions.js
  with a content like:
  export default (agenda: Agenda, definitionOnly = false) => {
    agenda.define(
      'some job',
      async (notification: {
        attrs: { data: { dealId: string; orderId: TypeObjectId<IOrder> } };
      }) => {
        // do something
      }
    );

    if (!definitionOnly) {
        // here you can create scheduled jobs or other things
    }
	});
  */
	if (agendaDefinition) {
		const loadDefinition = await import(agendaDefinition);
		(loadDefinition.default || loadDefinition)(agenda, true);
	}

  // run this job now
	await agenda.runForkedJob(jobId);

  // disconnect database and exit
	process.exit(0);
})().catch(err => {
	console.error('err', err);
	if (process.send) {
		process.send(JSON.stringify(err));
	}
	process.exit(1);
});


```

Ensure to only define job definitions during this step, otherwise you create some
overhead (e.g. if you create new jobs inside the defintion files). That's why I call
the defintion file with agenda and a second paramter that is set to true. If this
parameter is true, I do not initialize any jobs (create jobs etc..)

2.) to use this, you have to enable it on a job. Set forkMode to true:

```ts
const job = agenda.create('some job', { meep: 1 });
job.forkMode(true);
await job.save();
```

# Acknowledgements

- Agenda was originally created by [@rschmukler](https://github.com/rschmukler).
- [Agendash](https://github.com/agenda/agendash) was originally created by [@joeframbach](https://github.com/joeframbach).
- These days Agenda has a great community of [contributors](https://github.com/agenda/agenda/graphs/contributors) around it. Join us!

# License

[The MIT License](LICENSE.md)
