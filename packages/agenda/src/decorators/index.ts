/**
 * Agenda Decorators
 *
 * TypeScript decorators for defining job handlers in a declarative way.
 *
 * @example
 * ```typescript
 * import { Agenda, JobsController, Define, Every, registerJobs, Job } from 'agenda';
 * import { MongoBackend } from '@agendajs/mongo-backend';
 *
 * @JobsController({ namespace: 'email' })
 * class EmailJobs {
 *   @Define({ concurrency: 5 })
 *   async sendWelcome(job: Job<{ userId: string }>) {
 *     // Send welcome email
 *   }
 *
 *   @Every('1 hour')
 *   async cleanupBounced(job: Job) {
 *     // Cleanup bounced emails
 *   }
 * }
 *
 * const agenda = new Agenda({
 *   backend: new MongoBackend({ address: 'mongodb://localhost/agenda' })
 * });
 *
 * registerJobs(agenda, [new EmailJobs()]);
 * await agenda.start();
 *
 * // Schedule a job
 * await agenda.now('email.sendWelcome', { userId: '123' });
 * ```
 *
 * @module decorators
 */

// Class decorator
export { JobsController, type JobsControllerOptions } from './JobsController.js';

// Method decorators
export { Define, type DefineOptions } from './Define.js';
export { Every, type EveryOptions } from './Every.js';

// Registration utilities
export { registerJobs, getRegisteredJobsInfo, JobsRegistrationError } from './register.js';

// Metadata utilities (for advanced use cases)
export {
	getControllerMetadata,
	isJobsController,
	type ControllerMetadata,
	type JobMetadata,
	type ScheduleOptions
} from './metadata.js';
