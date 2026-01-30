import type { Agenda, JobState, JobWithState, JobsOverview, AgendaStatus, StateNotificationHandler, JobLogQuery, LogLevel, JobLogEvent } from 'agenda';
import type {
	AgendashController as IAgendashController,
	ApiQueryParams,
	ApiResponse,
	CreateJobRequest,
	CreateJobResponse,
	DeleteResponse,
	RequeueResponse,
	PauseResponse,
	ResumeResponse,
	FrontendJob,
	FrontendOverview,
	LogsQueryParams,
	LogsResponse
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
	private transformJob(job: JobWithState): FrontendJob {
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
				repeatTimezone: job.repeatTimezone,
				disabled: job.disabled,
				progress: job.progress
			},
			running: job.state === 'running',
			scheduled: job.state === 'scheduled',
			queued: job.state === 'queued',
			completed: job.state === 'completed',
			failed: job.state === 'failed',
			repeating: job.state === 'repeating',
			paused: job.disabled === true
		};
	}

	/**
	 * Transform overview from new API format to frontend format
	 */
	private transformOverview(overviews: JobsOverview[]): FrontendOverview[] {
		// Calculate totals for "All Jobs" entry
		const totals = overviews.reduce(
			(acc, o) => ({
				total: acc.total + o.total,
				running: acc.running + o.running,
				scheduled: acc.scheduled + o.scheduled,
				queued: acc.queued + o.queued,
				completed: acc.completed + o.completed,
				failed: acc.failed + o.failed,
				repeating: acc.repeating + o.repeating,
				paused: acc.paused + o.paused
			}),
			{ total: 0, running: 0, scheduled: 0, queued: 0, completed: 0, failed: 0, repeating: 0, paused: 0 }
		);

		const allJobsEntry: FrontendOverview = {
			displayName: 'All Jobs',
			...totals
		};

		const jobOverviews: FrontendOverview[] = overviews.map((o) => ({
			displayName: o.name,
			total: o.total,
			running: o.running,
			scheduled: o.scheduled,
			queued: o.queued,
			completed: o.completed,
			failed: o.failed,
			repeating: o.repeating,
			paused: o.paused
		}));

		return [allJobsEntry, ...jobOverviews];
	}

	/**
	 * Get jobs with overview and filtering
	 */
	async getJobs(params: ApiQueryParams): Promise<ApiResponse> {
		const { name, state, search, skip = 0, limit = 50 } = params;

		const [overview, result] = await Promise.all([
			this.agenda.getJobsOverview(),
			this.agenda.queryJobs({
				name: name || undefined,
				state: state as JobState | undefined,
				search: search || undefined,
				skip,
				limit,
				sort: { nextRunAt: 'desc' }
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
	async requeueJobs(ids: string[]): Promise<RequeueResponse> {
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
	async deleteJobs(ids: string[]): Promise<DeleteResponse> {
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
	async createJob(options: CreateJobRequest): Promise<CreateJobResponse> {
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

	/**
	 * Get running stats from the Agenda processor
	 */
	async getStats(fullDetails = false): Promise<AgendaStatus> {
		return this.agenda.getRunningStats(fullDetails);
	}

	/**
	 * Pause jobs by ID (disables them so they won't run)
	 */
	async pauseJobs(ids: string[]): Promise<PauseResponse> {
		if (!ids || ids.length === 0) {
			return { pausedCount: 0 };
		}

		const pausedCount = await this.agenda.disable({ ids });
		return { pausedCount };
	}

	/**
	 * Resume jobs by ID (re-enables them so they can run)
	 */
	async resumeJobs(ids: string[]): Promise<ResumeResponse> {
		if (!ids || ids.length === 0) {
			return { resumedCount: 0 };
		}

		const resumedCount = await this.agenda.enable({ ids });
		return { resumedCount };
	}

	/**
	 * Check if state notifications are available
	 */
	hasStateNotifications(): boolean {
		// Access the notification channel via the internal property
		// @ts-expect-error Accessing private property for state notification check
		const channel = this.agenda.notificationChannel;
		return !!channel?.subscribeState;
	}

	/**
	 * Create a subscription to job state notifications for real-time updates (SSE).
	 * This subscribes directly to the notification channel, bypassing the event re-emitting.
	 *
	 * @param onNotification - Callback function called for each state notification
	 * @returns Unsubscribe function to stop receiving notifications
	 * @throws Error if notification channel doesn't support state subscriptions
	 */
	createStateStream(onNotification: StateNotificationHandler): () => void {
		// Access the notification channel via the internal property
		// @ts-expect-error Accessing private property for state subscription
		const channel = this.agenda.notificationChannel;

		if (!channel?.subscribeState) {
			throw new Error('Notification channel does not support state subscriptions');
		}

		return channel.subscribeState(onNotification);
	}

	/**
	 * Check if persistent job logging is enabled
	 */
	hasLogging(): boolean {
		return this.agenda.hasJobLogger();
	}

	/**
	 * Get job log entries with filtering and pagination
	 */
	async getLogs(params: LogsQueryParams): Promise<LogsResponse> {
		if (!this.agenda.hasJobLogger()) {
			return { entries: [], total: 0, loggingEnabled: false };
		}

		const query: JobLogQuery = {
			jobId: params.jobId,
			jobName: params.jobName,
			limit: params.limit ?? 50,
			offset: params.offset ?? 0,
			sort: params.sort ?? 'desc'
		};

		if (params.level) {
			const levels = params.level.split(',') as LogLevel[];
			query.level = levels.length === 1 ? levels[0] : levels;
		}
		if (params.event) {
			const events = params.event.split(',') as JobLogEvent[];
			query.event = events.length === 1 ? events[0] : events;
		}
		if (params.from) {
			query.from = new Date(params.from);
		}
		if (params.to) {
			query.to = new Date(params.to);
		}

		const result = await this.agenda.getLogs(query);

		return {
			entries: result.entries.map(entry => ({
				...entry,
				timestamp: entry.timestamp.toISOString()
			})),
			total: result.total,
			loggingEnabled: true
		};
	}
}
