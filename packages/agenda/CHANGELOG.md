# agenda

## 6.2.7

### Patch Changes

- 17a68fa: Clear armed near-future job timers on `stop()`/`drain()`. Previously the JobProcessor armed an untracked `setTimeout` for jobs due within the `processEvery` window; it was never cleared, kept the event loop alive after `stop()`, and for recurring jobs with an interval ≤ `processEvery` could re-arm itself indefinitely — so the process never exited. Timers are now tracked, cleared on teardown, and `unref`'d so an armed timer alone can never block process exit.

## 6.2.6

### Patch Changes

- 3369032: Reset a job's backoff retry counter after a successful run. A recurring job that exhausted its retries earlier in its lifetime kept the old `failCount`, so a later failure was treated as already out of retries and stopped retrying.
- a072e7b: Fix recurring cron jobs skipping a valid occurrence. `computeFromInterval` compared the next cron tick against the stored `nextRunAt`, so when `nextRunAt` was further in the future than the next tick after `lastRunAt`, it bumped past and skipped the legitimate occurrence. It now only re-rolls when the tick is not strictly after `lastRunAt`.
- d90be16: Fix `@Every` jobs registered after the agenda was already ready never being scheduled. The scheduler relied on a one-shot `ready` event that had already fired, so it now uses the `ready` promise, which stays resolved.
- 42d17a3: Release the database lock when the processor frees a job whose `nextRunAt` is too far in the future. Previously such a job, when picked up via the expired-lock recovery path (for example a recurring job left locked by a crashed worker), was removed from the local locked list but never unlocked in the database, so it was re-locked on every scan and never reached its run time.
- 2b6c926: Fix processing queue order. `JobProcessingQueue.insert` placed the highest-priority (or earliest `nextRunAt`) job in the slot that runs last, because the queue is read from the end. Jobs queued in the same tick now run in the correct priority order.
- 08b1e22: Treat a numeric (or purely-numeric string) repeatInterval as milliseconds in computeFromInterval, so recurring jobs scheduled with `agenda.every(5000, 'job')` keep running on backends that persist the interval as a string.
- 24e7591: Fix start() race where concurrent calls leaked a second JobProcessor and connected the notification channel twice
- fd01a64: `stop()` no longer unlocks jobs that are still running, preventing duplicate concurrent execution of the same job occurrence on another instance during rolling restarts. Only jobs that are locked locally but have not started running are unlocked; running jobs keep their database lock until they complete (or `lockLifetime` expires if the process dies).

## 6.2.5

### Patch Changes

- 4a3db25: Document how to capture richer error context with fail event listeners.

## 6.2.4

### Patch Changes

- c386cd6: Add `cancelAll()` method to remove all jobs unconditionally. Also fix Redis backend ignoring `data` filter when combined with `name` in `cancel()`.

## 6.2.3

### Patch Changes

- d365969: Support TypeScript's `exactOptionalPropertyTypes` by adding explicit `| undefined` to optional properties in the `AgendaBackend` interface.
- f9437cc: Fix outdated documentation: rename `jobs()` to `queryJobs()`, update sort values to use `'asc'`/`'desc'` strings, fix sandboxed worker example to use pluggable backend API, correct MongoDB backend package name in comparison table, and rewrite connection recovery section to be backend-agnostic.
- 38530b6: Prevent unhandled 'error' events from crashing the process by registering a default no-op listener in the Agenda constructor.

## 6.2.2

### Patch Changes

- 75bb2ba: Add "default" export condition to all packages to support CommonJS require()

  The exports map only specified the "import" condition, which prevented CommonJS projects from using require() to load these packages. Node.js require() matches "require" or "default" conditions, not "import". With require(esm) now stable in Node.js 20.19+, 22.12+, and 24+, adding a "default" condition allows CJS projects to consume these ESM packages directly.

## 6.2.1

### Patch Changes

- fb05ddd: fix failed jobs

## 6.2.0

### Minor Changes

- 09e7b54: persistent log with pluggable architecture

### Patch Changes

- 758cb99: Remove `I` prefix from interface names for cleaner API

## 6.1.0

### Minor Changes

- 9c6843e: auto cleanup on job completion
- 605ba67: bi-directional state notificatoins

### Patch Changes

- c34ae31: configurable drain timeouts

## 6.0.0

### Major Changes

- 7b262a6: Refactor: Move MongoDB backend to separate package

### Minor Changes

- c23769b: Add job debouncing support to combine rapid job submissions into single execution

  Debouncing delays job execution and resets the timer on subsequent saves, ensuring the job only runs once after a quiet period. This is useful for scenarios like updating search indexes after rapid document changes, syncing user data after multiple updates, or rate-limiting notifications.

  Features:
  - New `.debounce(delay, options?)` method on Job class
  - Trailing strategy (default): execute after quiet period ends
  - Leading strategy: execute immediately, ignore subsequent calls during window
  - maxWait option: guarantee execution within maxWait even if saves keep coming
  - DB-backed implementation: survives process restarts and works across distributed instances
  - New `nowDebounced()` helper method on Agenda class

  Usage:

  ```typescript
  // Basic trailing debounce - execute 2s after last save
  await agenda
  	.create('updateSearchIndex', { entityType: 'products' })
  	.unique({ 'data.entityType': 'products' })
  	.debounce(2000)
  	.save();

  // With maxWait - guarantee execution within 30s
  await agenda
  	.create('syncUser', { userId: 123 })
  	.unique({ 'data.userId': 123 })
  	.debounce(5000, { maxWait: 30000 })
  	.save();

  // Leading strategy - execute immediately, ignore subsequent calls
  await agenda
  	.create('notify', { channel: '#alerts' })
  	.unique({ 'data.channel': '#alerts' })
  	.debounce(60000, { strategy: 'leading' })
  	.save();
  ```

- 5d53d72: Add automatic retry with backoff strategies for job failures
- b10bf2d: Add MongoDB Change Streams support for real-time job notifications
- 0aa54be: Add disable/enable job functionality across all backends
- 6420cdd: Add TypeScript decorators for class-based job definitions
- ce647d2: feat: add date range and skip days support for job scheduling

### Patch Changes

- 457adf6: full agenda postgres test suite and fixes
- 0f80e59: fix examples for Agenda job scheduler
- c946a23: feat: add legacy documentation versions for v4.x users
- 4a3f8ed: Move lastModifiedBy from backend config to Agenda-level, pass via repository method options
- f8e62ee: feat: add PostgreSQL backend package with LISTEN/NOTIFY support
- bfbeb12: Add Redis backend implementation for Agenda job scheduler
- 225a9f8: feat: add drain() method for graceful shutdown
- 073e62d: alpha 6.x release
- e6b3354: fix: race condition in fire-and-forget job.schedule().save() calls
- fda16c1: Simplify Job.save() to always exclude processor-managed fields
- 94f7e9b: feat: add connection ownership tracking and improve sort direction API
- f8e62ee: feat: add PostgreSQL backend package with LISTEN/NOTIFY support

## 6.0.0-alpha.0

### Major Changes

- 7b262a6: Refactor: Move MongoDB backend to separate package

### Patch Changes

- 457adf6: full agenda postgres test suite and fixes
- c946a23: feat: add legacy documentation versions for v4.x users
- 4a3f8ed: Move lastModifiedBy from backend config to Agenda-level, pass via repository method options
- f8e62ee: feat: add PostgreSQL backend package with LISTEN/NOTIFY support
- bfbeb12: Add Redis backend implementation for Agenda job scheduler
- 225a9f8: feat: add drain() method for graceful shutdown
- 073e62d: alpha 6.x release
- 94f7e9b: feat: add connection ownership tracking and improve sort direction API
- f8e62ee: feat: add PostgreSQL backend package with LISTEN/NOTIFY support
