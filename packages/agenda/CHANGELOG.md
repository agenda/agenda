# agenda

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
