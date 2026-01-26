# Agenda Decorators Proposal

This document outlines a proposal for adding TypeScript decorators to the agenda core library, inspired by [@tsed/agenda](https://tsed.dev/tutorials/agenda.html) and [node-ts-cache](https://github.com/havsar/node-ts-cache).

## Goals

1. **Framework-agnostic** - Work without Ts.ED or any other DI framework
2. **Type-safe** - Full TypeScript support with generics for job data
3. **Simple API** - Easy to use with minimal boilerplate
4. **Backward compatible** - Existing `agenda.define()` API continues to work
5. **Tree-shakeable** - Decorators are opt-in, not required

## Proposed Decorators

### Class Decorator: `@JobsController`

Marks a class as containing job handlers.

```typescript
import { JobsController } from 'agenda';

@JobsController({ namespace: 'email' })
class EmailJobs {
  // job methods here
}
```

**Options:**
- `namespace?: string` - Prefix for all job names in this class (e.g., `email.sendWelcome`)

### Method Decorator: `@Define`

Defines a job handler that can be scheduled programmatically.

```typescript
import { JobsController, Define, Job } from 'agenda';

@JobsController()
class EmailJobs {
  @Define({
    name: 'sendWelcome',  // optional, defaults to method name
    concurrency: 3,
    lockLifetime: 300000,
    priority: 'high'
  })
  async sendWelcome(job: Job<{ userId: string }>) {
    const { userId } = job.attrs.data;
    await sendEmail(userId);
  }
}
```

**Options:**
- `name?: string` - Job name (defaults to method name)
- `concurrency?: number` - Max concurrent executions
- `lockLifetime?: number` - Lock duration in ms
- `lockLimit?: number` - Max locks per interval
- `priority?: JobPriority` - Job priority

### Method Decorator: `@Every`

Defines a recurring job that runs on a schedule.

```typescript
import { JobsController, Every, Job } from 'agenda';

@JobsController({ namespace: 'maintenance' })
class MaintenanceJobs {
  @Every('0 0 * * *', {  // cron: daily at midnight
    name: 'cleanupOldData',
    timezone: 'America/New_York'
  })
  async cleanupOldData(job: Job) {
    await deleteOldRecords();
  }

  @Every('5 minutes')  // human-readable interval
  async healthCheck(job: Job) {
    await checkSystemHealth();
  }
}
```

**Options:**
- First argument: interval (cron string, human-readable, or milliseconds)
- `name?: string` - Job name
- `timezone?: string` - Timezone for cron
- `skipImmediate?: boolean` - Skip first immediate run
- `concurrency?: number` - Max concurrent executions
- `priority?: JobPriority` - Job priority

### Method Decorator: `@Schedule`

Defines a job scheduled for a specific time (one-time or relative).

```typescript
import { JobsController, Schedule, Job } from 'agenda';

@JobsController()
class NotificationJobs {
  @Schedule('tomorrow at noon')
  async sendReminder(job: Job<{ message: string }>) {
    // Will be registered and can be triggered via agenda.schedule()
  }
}
```

## Registration API

### Manual Registration

```typescript
import { Agenda, registerJobs } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';
import { EmailJobs } from './jobs/email';
import { MaintenanceJobs } from './jobs/maintenance';

const agenda = new Agenda({
  backend: new MongoBackend({ address: 'mongodb://localhost/agenda' })
});

// Register job classes
registerJobs(agenda, [
  new EmailJobs(),
  new MaintenanceJobs()
]);

await agenda.start();
```

### Fluent API Registration

```typescript
const agenda = new Agenda({
  backend: new MongoBackend({ address: 'mongodb://localhost/agenda' })
})
  .registerJobs(new EmailJobs())
  .registerJobs(new MaintenanceJobs());

await agenda.start();
```

### Auto-Discovery (optional)

```typescript
import { Agenda, discoverJobs } from 'agenda';

const agenda = new Agenda({ /* config */ });

// Scan directory for decorated classes
await discoverJobs(agenda, './src/jobs');

await agenda.start();
```

## Implementation Architecture

### 1. Metadata Storage

Use `reflect-metadata` or a simple Map-based registry to store decorator metadata:

```typescript
// packages/agenda/src/decorators/metadata.ts

const JOB_METADATA_KEY = Symbol('agenda:jobs');
const CONTROLLER_METADATA_KEY = Symbol('agenda:controller');

interface JobMetadata {
  type: 'define' | 'every' | 'schedule';
  methodName: string;
  options: DefineOptions | EveryOptions | ScheduleOptions;
  interval?: string | number;  // for @Every
}

interface ControllerMetadata {
  namespace?: string;
  jobs: Map<string, JobMetadata>;
}

// Store metadata on the class
export function setControllerMetadata(target: Function, metadata: ControllerMetadata) {
  Reflect.defineMetadata(CONTROLLER_METADATA_KEY, metadata, target);
}

export function getControllerMetadata(target: Function): ControllerMetadata | undefined {
  return Reflect.getMetadata(CONTROLLER_METADATA_KEY, target);
}
```

### 2. Decorator Implementations

```typescript
// packages/agenda/src/decorators/JobsController.ts

export interface JobsControllerOptions {
  namespace?: string;
}

export function JobsController(options: JobsControllerOptions = {}) {
  return function <T extends new (...args: any[]) => any>(target: T) {
    const existingMetadata = getControllerMetadata(target) || { jobs: new Map() };
    setControllerMetadata(target, {
      ...existingMetadata,
      namespace: options.namespace
    });
    return target;
  };
}
```

```typescript
// packages/agenda/src/decorators/Define.ts

export interface DefineOptions {
  name?: string;
  concurrency?: number;
  lockLifetime?: number;
  lockLimit?: number;
  priority?: JobPriority;
}

export function Define(options: DefineOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const metadata = getControllerMetadata(target.constructor) || { jobs: new Map() };
    metadata.jobs.set(propertyKey, {
      type: 'define',
      methodName: propertyKey,
      options
    });
    setControllerMetadata(target.constructor, metadata);
    return descriptor;
  };
}
```

```typescript
// packages/agenda/src/decorators/Every.ts

export interface EveryOptions extends DefineOptions {
  timezone?: string;
  skipImmediate?: boolean;
}

export function Every(interval: string | number, options: EveryOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const metadata = getControllerMetadata(target.constructor) || { jobs: new Map() };
    metadata.jobs.set(propertyKey, {
      type: 'every',
      methodName: propertyKey,
      interval,
      options
    });
    setControllerMetadata(target.constructor, metadata);
    return descriptor;
  };
}
```

### 3. Registration Function

```typescript
// packages/agenda/src/decorators/register.ts

export function registerJobs(agenda: Agenda, instances: object[]): void {
  for (const instance of instances) {
    const metadata = getControllerMetadata(instance.constructor);
    if (!metadata) {
      throw new Error(`Class ${instance.constructor.name} is not decorated with @JobsController`);
    }

    const namespace = metadata.namespace;

    for (const [methodName, jobMeta] of metadata.jobs) {
      const jobName = namespace
        ? `${namespace}.${jobMeta.options.name || methodName}`
        : (jobMeta.options.name || methodName);

      // Get the bound method
      const handler = (instance as any)[methodName].bind(instance);

      // Register the job definition
      agenda.define(jobName, handler, {
        concurrency: jobMeta.options.concurrency,
        lockLifetime: jobMeta.options.lockLifetime,
        lockLimit: jobMeta.options.lockLimit,
        priority: jobMeta.options.priority
      });

      // For @Every jobs, also schedule them
      if (jobMeta.type === 'every' && jobMeta.interval) {
        // Queue the scheduling for after agenda.start()
        agenda.on('ready', async () => {
          await agenda.every(jobMeta.interval!, jobName, {}, {
            timezone: (jobMeta.options as EveryOptions).timezone,
            skipImmediate: (jobMeta.options as EveryOptions).skipImmediate
          });
        });
      }
    }
  }
}
```

### 4. Agenda Class Extension

```typescript
// Add to packages/agenda/src/index.ts

class Agenda extends EventEmitter {
  // ... existing code ...

  /**
   * Register job handlers from decorated classes
   */
  registerJobs(...instances: object[]): this {
    registerJobs(this, instances);
    return this;
  }
}
```

## File Structure

```
packages/agenda/src/
├── decorators/
│   ├── index.ts              # Export all decorators
│   ├── metadata.ts           # Metadata storage utilities
│   ├── JobsController.ts     # @JobsController decorator
│   ├── Define.ts             # @Define decorator
│   ├── Every.ts              # @Every decorator
│   ├── Schedule.ts           # @Schedule decorator (optional)
│   └── register.ts           # registerJobs() function
├── index.ts                  # Add decorator exports
└── ... existing files
```

## TypeScript Configuration

```json
// packages/agenda/tsconfig.json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
    // ... other options
  }
}
```

## Dependencies

```json
{
  "dependencies": {
    "reflect-metadata": "^0.2.0"  // Optional, can use Map-based alternative
  }
}
```

## Usage Examples

### Basic Example

```typescript
import { Agenda, JobsController, Define, Every, Job } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';

// Define job handlers
@JobsController({ namespace: 'email' })
class EmailJobs {
  @Define({ concurrency: 5, priority: 'high' })
  async sendWelcome(job: Job<{ userId: string; template: string }>) {
    const { userId, template } = job.attrs.data;
    console.log(`Sending welcome email to user ${userId} with template ${template}`);
    // ... send email logic
  }

  @Every('1 hour', { name: 'cleanupBounced' })
  async cleanupBouncedEmails(job: Job) {
    console.log('Cleaning up bounced emails...');
    // ... cleanup logic
  }
}

@JobsController()
class ReportJobs {
  @Every('0 9 * * MON', { timezone: 'America/New_York' })  // Every Monday at 9 AM
  async weeklyReport(job: Job) {
    console.log('Generating weekly report...');
  }

  @Define()
  async generateCustomReport(job: Job<{ reportType: string; dateRange: [Date, Date] }>) {
    const { reportType, dateRange } = job.attrs.data;
    console.log(`Generating ${reportType} report for ${dateRange}`);
  }
}

// Initialize and start
const agenda = new Agenda({
  backend: new MongoBackend({ address: 'mongodb://localhost/agenda' })
});

agenda.on('error', console.error);

// Register job classes
agenda.registerJobs(
  new EmailJobs(),
  new ReportJobs()
);

await agenda.start();

// Schedule jobs programmatically
await agenda.now('email.sendWelcome', { userId: '123', template: 'welcome-v2' });
await agenda.schedule('in 2 hours', 'generateCustomReport', {
  reportType: 'sales',
  dateRange: [new Date('2024-01-01'), new Date('2024-01-31')]
});
```

### With Dependency Injection (manual)

```typescript
@JobsController({ namespace: 'notifications' })
class NotificationJobs {
  constructor(
    private emailService: EmailService,
    private pushService: PushService
  ) {}

  @Define()
  async sendPushNotification(job: Job<{ userId: string; message: string }>) {
    await this.pushService.send(job.attrs.data.userId, job.attrs.data.message);
  }

  @Define()
  async sendEmailNotification(job: Job<{ email: string; subject: string; body: string }>) {
    await this.emailService.send(job.attrs.data);
  }
}

// Create with dependencies
const notificationJobs = new NotificationJobs(
  new EmailService(),
  new PushService()
);

agenda.registerJobs(notificationJobs);
```

## Alternative: No reflect-metadata

For environments where `reflect-metadata` isn't desired, we can use a simple registry:

```typescript
// Simple registry without reflect-metadata
const jobRegistry = new WeakMap<Function, ControllerMetadata>();

export function JobsController(options: JobsControllerOptions = {}) {
  return function <T extends new (...args: any[]) => any>(target: T) {
    const existing = jobRegistry.get(target) || { jobs: new Map() };
    jobRegistry.set(target, { ...existing, namespace: options.namespace });
    return target;
  };
}

export function getControllerMetadata(target: Function): ControllerMetadata | undefined {
  return jobRegistry.get(target);
}
```

## Comparison with @tsed/agenda

| Feature | @tsed/agenda | This Proposal |
|---------|--------------|---------------|
| Framework dependency | Requires Ts.ED | Framework-agnostic |
| DI integration | Built-in via Ts.ED | Manual or BYO-DI |
| Decorator API | `@Agenda`, `@Every`, `@Define` | `@JobsController`, `@Every`, `@Define` |
| Auto-discovery | Via Ts.ED module system | Optional utility function |
| Lifecycle hooks | `$beforeAgendaStart`, `$afterAgendaStart` | Via Agenda events |
| Type safety | Good | Full generics support |

## Migration Path

Existing code using `agenda.define()` continues to work unchanged:

```typescript
// Still works!
agenda.define('oldJob', async (job) => {
  console.log('Running old job');
});

// New decorator-based jobs can coexist
@JobsController()
class NewJobs {
  @Define()
  async newJob(job: Job) {
    console.log('Running new job');
  }
}

agenda.registerJobs(new NewJobs());
```

## Open Questions

1. **Should we support auto-discovery?** Scanning directories adds complexity but improves DX.

2. **Should `@Every` jobs auto-schedule on registration or on `agenda.start()`?**
   - Proposed: On `agenda.start()` via the 'ready' event

3. **Should we support callback-style handlers in decorators?**
   - Proposed: No, async/await only for decorated methods

4. **Should there be a `@Once` decorator for one-time scheduled jobs?**
   - Could be useful for jobs like "send report next Monday"

5. **How to handle job data typing with generics?**
   - Proposed: Use `Job<T>` generic type parameter

## Next Steps

1. Implement core decorator infrastructure
2. Add unit tests for decorators and registration
3. Update documentation with decorator examples
4. Consider adding to a separate entry point for tree-shaking: `agenda/decorators`
