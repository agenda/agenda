import { getOrCreateControllerMetadata, setControllerMetadata } from './metadata.js';

/**
 * Options for the @JobsController decorator
 */
export interface JobsControllerOptions {
	/**
	 * Namespace prefix for all jobs in this class.
	 * Job names will be formatted as "namespace.jobName"
	 * @example
	 * ```typescript
	 * @JobsController({ namespace: 'email' })
	 * class EmailJobs {
	 *   @Define()
	 *   async sendWelcome(job: Job) {} // registered as "email.sendWelcome"
	 * }
	 * ```
	 */
	namespace?: string;
}

/**
 * Class decorator that marks a class as containing job handlers.
 *
 * @param options - Configuration options for the jobs controller
 * @returns Class decorator
 *
 * @example
 * ```typescript
 * import { JobsController, Define, Every } from 'agenda';
 *
 * @JobsController({ namespace: 'notifications' })
 * class NotificationJobs {
 *   @Define()
 *   async sendPush(job: Job<{ userId: string }>) {
 *     // Handle push notification
 *   }
 *
 *   @Every('5 minutes')
 *   async checkPending(job: Job) {
 *     // Check for pending notifications
 *   }
 * }
 * ```
 */
export function JobsController(options: JobsControllerOptions = {}) {
	return function <T extends new (...args: any[]) => any>(target: T): T {
		const metadata = getOrCreateControllerMetadata(target);
		setControllerMetadata(target, {
			...metadata,
			namespace: options.namespace
		});
		return target;
	};
}
