import { getOrCreateControllerMetadata, type DefineOptions } from './metadata.js';

export type { DefineOptions };

/**
 * Method decorator that defines a job handler.
 *
 * Jobs decorated with @Define must be scheduled programmatically using
 * `agenda.now()`, `agenda.schedule()`, or `agenda.every()`.
 *
 * @param options - Configuration options for the job definition
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * import { JobsController, Define, Job } from 'agenda';
 *
 * @JobsController()
 * class EmailJobs {
 *   @Define({
 *     name: 'sendWelcome',
 *     concurrency: 5,
 *     priority: 'high'
 *   })
 *   async sendWelcomeEmail(job: Job<{ userId: string; template: string }>) {
 *     const { userId, template } = job.attrs.data;
 *     await this.emailService.send(userId, template);
 *   }
 * }
 *
 * // Later, schedule the job:
 * await agenda.now('sendWelcome', { userId: '123', template: 'welcome' });
 * ```
 */
export function Define(options: DefineOptions = {}) {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Standard decorator signature requires any for target
	return function (target: any, propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor {
		const metadata = getOrCreateControllerMetadata(target.constructor);

		metadata.jobs.set(propertyKey, {
			type: 'define',
			methodName: propertyKey,
			options
		});

		return descriptor;
	};
}
