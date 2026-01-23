import type { Agenda, JobState, IJobWithState, IJobsOverview } from 'agenda';
import type {
	IAgendashController,
	IApiQueryParams,
	IApiResponse,
	ICreateJobRequest,
	ICreateJobResponse,
	IDeleteResponse,
	IRequeueResponse,
	IFrontendJob,
	IFrontendOverview
} from './types.js';

/**
 * Agendash Controller - Core logic for dashboard operations
 *
 * Uses the database-agnostic Agenda API (v6) for all operations:
 * - agenda.queryJobs() for filtering, pagination, state computation
 * - agenda.getJobsOverview() for statistics
 * - agenda.cancel() for deletion
 */
export class AgendashController implements IAgendashController {
	constructor(private agenda: Agenda) {}

	/**
	 * Transform a job from the new API format to the frontend format
	 */
	private transformJob(job: IJobWithState): IFrontendJob {
		return {
			job: {
				_id: String(job._id),
				name: job.name,
				data: job.data,
				priority: job.priority,
				nextRunAt: job.nextRunAt,
				lastRunAt: job.lastRunAt,
				lastFinishedAt: job.lastFinishedAt,
				lockedAt: job.lockedAt,
				failedAt: job.failedAt,
				failCount: job.failCount,
				failReason: job.failReason,
				repeatInterval: job.repeatInterval,
				repeatTimezone: job.repeatTimezone
			},
			running: job.state === 'running',
			scheduled: job.state === 'scheduled',
			queued: job.state === 'queued',
			completed: job.state === 'completed',
			failed: job.state === 'failed',
			repeating: job.state === 'repeating'
		};
	}

	/**
	 * Transform overview from new API format to frontend format
	 */
	private transformOverview(overviews: IJobsOverview[]): IFrontendOverview[] {
		// Calculate totals for "All Jobs" entry
		const totals = overviews.reduce(
			(acc, o) => ({
				total: acc.total + o.total,
				running: acc.running + o.running,
				scheduled: acc.scheduled + o.scheduled,
				queued: acc.queued + o.queued,
				completed: acc.completed + o.completed,
				failed: acc.failed + o.failed,
				repeating: acc.repeating + o.repeating
			}),
			{ total: 0, running: 0, scheduled: 0, queued: 0, completed: 0, failed: 0, repeating: 0 }
		);

		const allJobsEntry: IFrontendOverview = {
			displayName: 'All Jobs',
			...totals
		};

		const jobOverviews: IFrontendOverview[] = overviews.map((o) => ({
			displayName: o.name,
			total: o.total,
			running: o.running,
			scheduled: o.scheduled,
			queued: o.queued,
			completed: o.completed,
			failed: o.failed,
			repeating: o.repeating
		}));

		return [allJobsEntry, ...jobOverviews];
	}

	/**
	 * Get jobs with overview and filtering
	 */
	async getJobs(params: IApiQueryParams): Promise<IApiResponse> {
		const { name, state, search, skip = 0, limit = 50 } = params;

		const [overview, result] = await Promise.all([
			this.agenda.getJobsOverview(),
			this.agenda.queryJobs({
				name: name || undefined,
				state: state as JobState | undefined,
				search: search || undefined,
				skip,
				limit,
				sort: { nextRunAt: -1 }
			})
		]);

		const transformedJobs = result.jobs.map((job) => this.transformJob(job));
		const transformedOverview = this.transformOverview(overview);
		const totalPages = Math.ceil(result.total / limit) || 1;

		return {
			overview: transformedOverview,
			jobs: transformedJobs,
			total: result.total,
			totalPages
		};
	}

	/**
	 * Requeue jobs by creating new instances
	 */
	async requeueJobs(ids: string[]): Promise<IRequeueResponse> {
		if (!ids || ids.length === 0) {
			return { requeuedCount: 0 };
		}

		const { jobs } = await this.agenda.queryJobs({ ids });
		let requeuedCount = 0;

		for (const job of jobs) {
			await this.agenda.now(job.name, job.data);
			requeuedCount++;
		}

		return { requeuedCount };
	}

	/**
	 * Delete jobs by ID
	 */
	async deleteJobs(ids: string[]): Promise<IDeleteResponse> {
		if (!ids || ids.length === 0) {
			return { deleted: false, deletedCount: 0 };
		}

		const deletedCount = await this.agenda.cancel({ ids });
		return {
			deleted: deletedCount > 0,
			deletedCount
		};
	}

	/**
	 * Create a new job
	 */
	async createJob(options: ICreateJobRequest): Promise<ICreateJobResponse> {
		const { jobName, jobSchedule, jobRepeatEvery, jobData } = options;

		if (!jobName) {
			throw new Error('jobName is required');
		}

		if (jobRepeatEvery) {
			await this.agenda.every(jobRepeatEvery, jobName, jobData);
		} else if (jobSchedule) {
			await this.agenda.schedule(jobSchedule, jobName, jobData);
		} else {
			await this.agenda.now(jobName, jobData);
		}

		return { created: true };
	}
}
