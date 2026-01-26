# Agenda Decorators

TypeScript decorators for defining job handlers in a declarative, class-based style.

## Overview

Agenda decorators provide an alternative to `agenda.define()` that lets you organize jobs into classes with dependency injection support. This is inspired by [@tsed/agenda](https://tsed.dev/tutorials/agenda.html) but works without any framework dependencies.

```typescript
import { Agenda, JobsController, Define, Every, registerJobs, Job } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';

@JobsController({ namespace: 'email' })
class EmailJobs {
  constructor(private emailService: EmailService) {}

  @Define({ concurrency: 5, priority: 'high' })
  async sendWelcome(job: Job<{ userId: string }>) {
    await this.emailService.sendWelcome(job.attrs.data.userId);
  }

  @Every('1 hour')
  async cleanupBounced(job: Job) {
    await this.emailService.cleanupBounced();
  }
}

const agenda = new Agenda({
  backend: new MongoBackend({ address: 'mongodb://localhost/agenda' })
});

registerJobs(agenda, [new EmailJobs(new EmailService())]);
await agenda.start();

// Schedule jobs using the namespaced name
await agenda.now('email.sendWelcome', { userId: '123' });
```

## Installation

Decorators are included in the core `agenda` package. No additional installation required.

**TypeScript Configuration:**

Ensure your `tsconfig.json` has decorators enabled:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true
  }
}
```

## Decorators

### @JobsController

Class decorator that marks a class as containing job handlers.

```typescript
@JobsController()
class MyJobs { }

// With namespace - all job names are prefixed
@JobsController({ namespace: 'email' })
class EmailJobs {
  @Define()
  async send(job: Job) { }  // Job name: "email.send"
}
```

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `namespace` | `string` | Optional prefix for all job names in this class |

### @Define

Method decorator that registers a job handler. Jobs must be scheduled manually using `agenda.now()`, `agenda.schedule()`, or `agenda.every()`.

```typescript
@JobsController()
class MyJobs {
  @Define()
  async processOrder(job: Job<{ orderId: string }>) {
    const { orderId } = job.attrs.data;
    // Process order...
  }

  @Define({
    name: 'custom-name',      // Override job name
    concurrency: 10,          // Max concurrent executions
    lockLifetime: 300000,     // Lock duration (5 min)
    priority: 'high'          // Job priority
  })
  async importantTask(job: Job) { }
}
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | `string` | method name | Job name (combined with namespace if set) |
| `concurrency` | `number` | Agenda default | Max concurrent executions |
| `lockLifetime` | `number` | Agenda default | Lock duration in milliseconds |
| `lockLimit` | `number` | Agenda default | Max locks per interval |
| `priority` | `JobPriority` | `'normal'` | `'lowest'`, `'low'`, `'normal'`, `'high'`, `'highest'`, or number |

### @Every

Method decorator that defines a recurring job. The job is automatically scheduled when `agenda.start()` is called.

```typescript
@JobsController()
class MaintenanceJobs {
  // Human-readable interval
  @Every('5 minutes')
  async healthCheck(job: Job) { }

  // Cron expression
  @Every('0 9 * * MON', { timezone: 'America/New_York' })
  async weeklyReport(job: Job) { }

  // With options
  @Every('1 hour', {
    name: 'cleanup',
    concurrency: 1,
    skipImmediate: true  // Don't run immediately on start
  })
  async cleanup(job: Job) { }
}
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | `string` | method name | Job name |
| `timezone` | `string` | - | Timezone for cron expressions |
| `skipImmediate` | `boolean` | `false` | Skip first immediate execution |
| `concurrency` | `number` | Agenda default | Max concurrent executions |
| `lockLifetime` | `number` | Agenda default | Lock duration in milliseconds |
| `priority` | `JobPriority` | `'normal'` | Job priority |

## Registration

### registerJobs()

Register job handler classes with an Agenda instance.

```typescript
import { registerJobs } from 'agenda';

const emailJobs = new EmailJobs(emailService);
const reportJobs = new ReportJobs(reportService);

registerJobs(agenda, [emailJobs, reportJobs]);
```

Classes must be decorated with `@JobsController` or an error is thrown.

### getRegisteredJobsInfo()

Get metadata about registered job classes (useful for debugging).

```typescript
import { getRegisteredJobsInfo } from 'agenda';

const info = getRegisteredJobsInfo([emailJobs, reportJobs]);
console.log(info);
// [
//   { className: 'EmailJobs', namespace: 'email', jobs: [...] },
//   { className: 'ReportJobs', namespace: undefined, jobs: [...] }
// ]
```

## Dependency Injection

Since you instantiate job classes yourself, you can inject dependencies via the constructor:

```typescript
// Services
class EmailService {
  async send(to: string, subject: string) { /* ... */ }
}

class AnalyticsService {
  async track(event: string, data: object) { /* ... */ }
}

// Job handler with dependencies
@JobsController({ namespace: 'notifications' })
class NotificationJobs {
  constructor(
    private emailService: EmailService,
    private analytics: AnalyticsService
  ) {}

  @Define()
  async sendNotification(job: Job<{ userId: string; message: string }>) {
    const { userId, message } = job.attrs.data;
    await this.emailService.send(userId, message);
    await this.analytics.track('notification_sent', { userId });
  }
}

// Wire up dependencies manually
const emailService = new EmailService();
const analytics = new AnalyticsService();
const notificationJobs = new NotificationJobs(emailService, analytics);

registerJobs(agenda, [notificationJobs]);
```

This works with any DI container (InversifyJS, tsyringe, etc.) - just resolve the class from your container before registering.

## Complete Example

```typescript
import { Agenda, JobsController, Define, Every, registerJobs, Job } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';

// ============================================
// Services
// ============================================

class EmailService {
  async sendWelcome(userId: string) {
    console.log(`Sending welcome email to ${userId}`);
  }

  async sendDigest(userId: string) {
    console.log(`Sending digest to ${userId}`);
  }
}

// ============================================
// Job Handlers
// ============================================

@JobsController({ namespace: 'email' })
class EmailJobs {
  constructor(private emailService: EmailService) {}

  @Define({ concurrency: 5, priority: 'high' })
  async sendWelcome(job: Job<{ userId: string }>) {
    await this.emailService.sendWelcome(job.attrs.data.userId);
  }

  @Every('0 9 * * *', { timezone: 'UTC' })
  async dailyDigest(job: Job) {
    // In real app, would fetch users from DB
    await this.emailService.sendDigest('all-users');
  }
}

@JobsController()
class MaintenanceJobs {
  @Every('5 minutes')
  async healthCheck(job: Job) {
    console.log('Health check:', new Date().toISOString());
  }

  @Define({ lockLifetime: 30 * 60 * 1000 })  // 30 min lock for long jobs
  async generateReport(job: Job<{ type: string }>) {
    console.log(`Generating ${job.attrs.data.type} report...`);
    // Long-running report generation
    for (let i = 0; i <= 100; i += 20) {
      await job.touch(i);  // Update progress
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

// ============================================
// Main
// ============================================

async function main() {
  const agenda = new Agenda({
    backend: new MongoBackend({ address: 'mongodb://localhost/agenda' })
  });

  agenda.on('error', console.error);

  // Create instances with dependencies
  const emailJobs = new EmailJobs(new EmailService());
  const maintenanceJobs = new MaintenanceJobs();

  // Register all job handlers
  registerJobs(agenda, [emailJobs, maintenanceJobs]);

  // Start processing
  await agenda.start();
  console.log('Agenda started');

  // Schedule some jobs
  await agenda.now('email.sendWelcome', { userId: 'user-123' });
  await agenda.schedule('in 10 seconds', 'generateReport', { type: 'sales' });

  // Keep running...
}

main().catch(console.error);
```

## Mixing Decorators with agenda.define()

Decorator-based jobs work alongside traditional `agenda.define()`:

```typescript
// Traditional style
agenda.define('legacy-job', async (job) => {
  console.log('Legacy job running');
});

// Decorator style
@JobsController()
class NewJobs {
  @Define()
  async modernJob(job: Job) {
    console.log('Modern job running');
  }
}

registerJobs(agenda, [new NewJobs()]);

// Both work
await agenda.now('legacy-job');
await agenda.now('modernJob');
```

## How It Works

Decorators use a `WeakMap` to store metadata about job handlers:

1. `@JobsController` marks the class and stores namespace
2. `@Define` / `@Every` store method metadata (name, options, interval)
3. `registerJobs()` reads metadata and calls `agenda.define()` for each method
4. For `@Every` jobs, scheduling happens when Agenda emits the `ready` event

No external dependencies like `reflect-metadata` are required.

## API Reference

### Types

```typescript
interface JobsControllerOptions {
  namespace?: string;
}

interface DefineOptions {
  name?: string;
  concurrency?: number;
  lockLifetime?: number;
  lockLimit?: number;
  priority?: 'lowest' | 'low' | 'normal' | 'high' | 'highest' | number;
}

interface EveryOptions extends DefineOptions {
  timezone?: string;
  skipImmediate?: boolean;
}
```

### Exports

```typescript
// Decorators
export { JobsController } from 'agenda';
export { Define } from 'agenda';
export { Every } from 'agenda';

// Registration
export { registerJobs } from 'agenda';
export { getRegisteredJobsInfo } from 'agenda';

// Errors
export { JobsRegistrationError } from 'agenda';

// Metadata utilities (advanced)
export { getControllerMetadata, isJobsController } from 'agenda';
```
