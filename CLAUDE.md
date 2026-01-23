# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agenda is a lightweight, MongoDB-backed job scheduling library for Node.js. It's a TypeScript rewrite of agenda.js with full typing, MongoDB 4+ driver support, and improvements for distributed job processing.

This is a pnpm monorepo with the following packages:
- `packages/agenda` - Core scheduler (published as "agenda" on npm)
- `packages/agendash` - Placeholder for dashboard integration

## Common Commands

```bash
# Build all packages
pnpm build

# Testing (runs all package tests)
pnpm test

# Run agenda package tests directly
pnpm --filter agenda test

# Run single test file
pnpm --filter agenda exec mocha test/job.test.ts

# Run tests matching a pattern
pnpm --filter agenda exec mocha --grep "pattern"

# Debug with agenda logging
DEBUG=agenda:**,-agenda:internal:** pnpm --filter agenda test
DEBUG=agenda:** pnpm --filter agenda test

# Linting
pnpm lint                        # ESLint check
pnpm lint:fix                    # ESLint with auto-fix
```

## Architecture

### Core Components

```
Agenda (packages/agenda/src/index.ts)    # Main class, extends EventEmitter
├── JobProcessor                          # Handles job execution loop and concurrency
├── JobDbRepository                       # MongoDB data layer abstraction
├── Job                                   # Individual job with lifecycle methods
└── JobProcessingQueue                    # Priority queue for pending jobs
```

### Source Structure

- `packages/agenda/src/index.ts` - Agenda class: configuration, job definition, scheduling API
- `packages/agenda/src/Job.ts` - Job class: save, remove, run, touch, schedule methods
- `packages/agenda/src/JobProcessor.ts` - Processing loop, locking, concurrent execution
- `packages/agenda/src/JobDbRepository.ts` - MongoDB operations abstraction
- `packages/agenda/src/JobProcessingQueue.ts` - Priority-based job queue
- `packages/agenda/src/types/` - TypeScript interfaces (AgendaConfig, JobDefinition, JobParameters)
- `packages/agenda/src/utils/` - Helpers for priority parsing, interval calculation, date handling

### Key Patterns

**Event-Driven Architecture**: Agenda emits events for job lifecycle:
- `start`, `complete`, `success`, `fail` (with job-specific variants like `start:jobName`)
- `ready`, `error` for Agenda lifecycle

**Distributed Locking**: Jobs use MongoDB `lockedAt` field for distributed execution:
- Prevents duplicate execution across multiple Agenda instances
- Default lock lifetime: 10 minutes (configurable per job)

**Job Scheduling Formats**:
- Human-readable: `'3 minutes'`, `'1 week'`
- Cron: `'*/5 * * * *'`
- Milliseconds: `5000`

**Job Types**:
- `normal` - Regular job, can have multiple instances
- `single` - Only one instance in DB (used by `.every()`)

### Testing

Tests use mongodb-memory-server for isolation. Test helper at `packages/agenda/test/helpers/mock-mongodb.ts`:

```typescript
import { mockMongo } from './helpers/mock-mongodb';

const { mongo, disconnect } = await mockMongo();
const agenda = new Agenda({ mongo: mongo.db() });
// ... tests
disconnect();
```

## Configuration Defaults

```typescript
{
  processEvery: 5000,           // Scan interval (ms)
  defaultConcurrency: 5,        // Per-job concurrency
  maxConcurrency: 20,           // Global max running jobs
  defaultLockLifetime: 600000,  // 10 minutes
  sort: { nextRunAt: 1, priority: -1 }
}
```

## Database Index

Agenda does not create indexes by default. Recommended index for production:

```javascript
db.agendaJobs.createIndex({
  "name": 1,
  "nextRunAt": 1,
  "priority": -1,
  "lockedAt": 1,
  "disabled": 1
}, { name: "findAndLockNextJobIndex" })
```

## Debug Logging

Uses the `debug` library with namespace `agenda:*`:

```bash
DEBUG=agenda:* pnpm test        # All agenda logs
DEBUG=agenda:job pnpm test      # Job-specific logs
DEBUG=agenda:jobProcessor pnpm test  # Processor logs
```
