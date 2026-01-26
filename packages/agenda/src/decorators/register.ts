import type { Agenda } from '../index.js';
import type { Job } from '../Job.js';
import {
	getControllerMetadata,
	isJobsController,
	type ControllerMetadata,
	type EveryOptions,
	type JobMetadata
} from './metadata.js';

/**
 * Error thrown when attempting to register an invalid jobs controller
 */
export class JobsRegistrationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'JobsRegistrationError';
	}
}

/**
 * Internal type for pending @Every job schedules
 */
interface PendingEveryJob {
	jobName: string;
	interval: string | number;
	options: EveryOptions;
}

/**
 * Register job handlers from decorated class instances with an Agenda instance.
 *
 * This function reads the metadata from classes decorated with `@JobsController`
 * and registers their methods as job handlers.
 *
 * @param agenda - The Agenda instance to register jobs with
 * @param instances - Array of instantiated job controller classes
 * @throws {JobsRegistrationError} If a class is not decorated with @JobsController
 *
 * @example
 * ```typescript
 * import { Agenda, registerJobs } from 'agenda';
 * import { MongoBackend } from '@agendajs/mongo-backend';
 * import { EmailJobs } from './jobs/email';
 * import { ReportJobs } from './jobs/reports';
 *
 * const agenda = new Agenda({
 *   backend: new MongoBackend({ address: 'mongodb://localhost/agenda' })
 * });
 *
 * // Create instances (can inject dependencies via constructor)
 * const emailJobs = new EmailJobs(emailService);
 * const reportJobs = new ReportJobs(reportService);
 *
 * // Register all job handlers
 * registerJobs(agenda, [emailJobs, reportJobs]);
 *
 * await agenda.start();
 * ```
 */
export function registerJobs(agenda: Agenda, instances: object[]): void {
	const pendingEveryJobs: PendingEveryJob[] = [];

	for (const instance of instances) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- instance.constructor is typed as Function
		const constructor = instance.constructor as new (...args: any[]) => any;

		// Validate that the class is decorated
		if (!isJobsController(constructor)) {
			throw new JobsRegistrationError(
				`Class "${constructor.name}" is not decorated with @JobsController. ` +
					'Make sure to add @JobsController() decorator to your class.'
			);
		}

		const metadata = getControllerMetadata(constructor);
		if (!metadata) {
			continue;
		}

		registerJobsFromMetadata(agenda, instance, metadata, pendingEveryJobs);
	}

	// Schedule @Every jobs after agenda starts
	if (pendingEveryJobs.length > 0) {
		scheduleEveryJobsOnReady(agenda, pendingEveryJobs);
	}
}

/**
 * Register jobs from a single controller's metadata
 */
function registerJobsFromMetadata(
	agenda: Agenda,
	instance: object,
	metadata: ControllerMetadata,
	pendingEveryJobs: PendingEveryJob[]
): void {
	const namespace = metadata.namespace;

	for (const [methodName, jobMeta] of metadata.jobs) {
		const jobName = buildJobName(namespace, jobMeta.options.name || methodName);

		// Bind the method to the instance
		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic method access requires any
		const handler = (instance as any)[methodName].bind(instance);

		// Create an async wrapper that matches Agenda's expected signature
		const wrappedHandler = async (job: Job): Promise<void> => {
			await handler(job);
		};

		// Register the job definition with Agenda
		agenda.define(jobName, wrappedHandler, {
			concurrency: jobMeta.options.concurrency,
			lockLifetime: jobMeta.options.lockLifetime,
			lockLimit: jobMeta.options.lockLimit,
			priority: jobMeta.options.priority
		});

		// Queue @Every jobs for scheduling after start
		if (jobMeta.type === 'every' && jobMeta.interval !== undefined) {
			pendingEveryJobs.push({
				jobName,
				interval: jobMeta.interval,
				options: jobMeta.options as EveryOptions
			});
		}
	}
}

/**
 * Build the full job name with optional namespace prefix
 */
function buildJobName(namespace: string | undefined, name: string): string {
	return namespace ? `${namespace}.${name}` : name;
}

/**
 * Schedule @Every jobs when Agenda emits the 'ready' event
 */
function scheduleEveryJobsOnReady(agenda: Agenda, pendingJobs: PendingEveryJob[]): void {
	const scheduleJobs = async () => {
		for (const pending of pendingJobs) {
			await agenda.every(pending.interval, pending.jobName, undefined, {
				timezone: pending.options.timezone,
				skipImmediate: pending.options.skipImmediate
			});
		}
	};

	// If agenda is already started, schedule immediately
	// Otherwise, wait for the 'ready' event
	agenda.once('ready', () => {
		scheduleJobs().catch(err => {
			agenda.emit('error', err);
		});
	});
}

/**
 * Get information about registered jobs from decorated classes.
 * Useful for debugging and introspection.
 *
 * @param instances - Array of job controller instances
 * @returns Array of job registration info
 */
export function getRegisteredJobsInfo(
	instances: object[]
): Array<{ className: string; namespace?: string; jobs: JobMetadata[] }> {
	return instances.map(instance => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- instance.constructor is typed as Function
		const constructor = instance.constructor as new (...args: any[]) => any;
		const metadata = getControllerMetadata(constructor);

		return {
			className: constructor.name,
			namespace: metadata?.namespace,
			jobs: metadata ? Array.from(metadata.jobs.values()) : []
		};
	});
}
