import { getOrCreateControllerMetadata, type EveryOptions } from './metadata.js';

export type { EveryOptions };

/**
 * Method decorator that defines a recurring job.
 *
 * Jobs decorated with @Every are automatically scheduled when registered
 * with the Agenda instance. They will run at the specified interval.
 *
 * @param interval - The interval at which the job should run.
 *                   Can be a cron expression, human-readable string, or milliseconds.
 * @param options - Configuration options for the job
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * import { JobsController, Every, Job } from 'agenda';
 *
 * @JobsController({ namespace: 'maintenance' })
 * class MaintenanceJobs {
 *   // Run every 5 minutes
 *   @Every('5 minutes')
 *   async healthCheck(job: Job) {
 *     await this.checkSystemHealth();
 *   }
 *
 *   // Run daily at midnight using cron
 *   @Every('0 0 * * *', {
 *     name: 'dailyCleanup',
 *     timezone: 'America/New_York'
 *   })
 *   async cleanupOldData(job: Job) {
 *     await this.deleteOldRecords();
 *   }
 *
 *   // Run every hour with high priority
 *   @Every('1 hour', { priority: 'high', concurrency: 1 })
 *   async generateReport(job: Job) {
 *     await this.createHourlyReport();
 *   }
 * }
 * ```
 */
export function Every(interval: string | number, options: EveryOptions = {}) {
	return function (
		target: any,
		propertyKey: string,
		descriptor: PropertyDescriptor
	): PropertyDescriptor {
		const metadata = getOrCreateControllerMetadata(target.constructor);

		metadata.jobs.set(propertyKey, {
			type: 'every',
			methodName: propertyKey,
			interval,
			options
		});

		return descriptor;
	};
}
