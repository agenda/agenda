import type { JobId } from './JobParameters.js';

/**
 * Notification payload sent when a job is saved/updated
 */
export interface JobNotification {
	jobId: JobId;
	jobName: string;
	nextRunAt: Date | null;
	priority: number;
	timestamp: Date;
	source?: string;
}

/**
 * Types of job state events that can be published
 */
export type JobStateType = 'start' | 'progress' | 'success' | 'fail' | 'complete' | 'retry';

/**
 * Notification payload sent when a job's state changes during execution.
 * This enables bi-directional communication so that all subscribers
 * can receive job lifecycle events (start, success, fail, complete, etc.)
 */
export interface JobStateNotification {
	type: JobStateType;
	jobId: JobId;
	jobName: string;
	timestamp: Date;
	source?: string;
	/** Progress percentage (0-100) for 'progress' events */
	progress?: number;
	/** Error message for 'fail' events */
	error?: string;
	/** Failure count for 'fail' events */
	failCount?: number;
	/** Scheduled retry time for 'retry' events */
	retryAt?: Date;
	/** Retry attempt number for 'retry' events */
	retryAttempt?: number;
	/** Job execution duration in ms for 'complete' events */
	duration?: number;
	/** When the job started for 'complete' events */
	lastRunAt?: Date;
	/** When the job finished for 'complete' events */
	lastFinishedAt?: Date;
}

/**
 * Handler function for processing job state notifications
 */
export type StateNotificationHandler = (notification: JobStateNotification) => void | Promise<void>;

/**
 * Handler function for processing job notifications
 */
export type NotificationHandler = (notification: JobNotification) => void | Promise<void>;

/**
 * Possible states of a notification channel
 */
export type NotificationChannelState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

/**
 * Configuration options for notification channels
 */
export interface NotificationChannelConfig {
	channelName?: string;
	reconnect?: {
		enabled: boolean;
		maxAttempts?: number;
		initialDelayMs?: number;
		maxDelayMs?: number;
	};
}

/**
 * Interface for notification channels that enable cross-process job notifications.
 * Implementations can use Redis, PostgreSQL LISTEN/NOTIFY, or other pub/sub systems.
 */
export interface NotificationChannel {
	/**
	 * Current state of the channel
	 */
	readonly state: NotificationChannelState;

	/**
	 * Connect to the notification backend
	 */
	connect(): Promise<void>;

	/**
	 * Disconnect from the notification backend
	 */
	disconnect(): Promise<void>;

	/**
	 * Subscribe to job notifications
	 * @param handler - Function to call when a notification is received
	 * @returns Unsubscribe function
	 */
	subscribe(handler: NotificationHandler): () => void;

	/**
	 * Publish a job notification
	 * @param notification - The notification to publish
	 */
	publish(notification: JobNotification): Promise<void>;

	/**
	 * Register an event listener
	 */
	on(event: 'stateChange', listener: (state: NotificationChannelState) => void): this;
	on(event: 'error', listener: (error: Error) => void): this;

	/**
	 * Remove an event listener
	 */
	off(event: 'stateChange', listener: (state: NotificationChannelState) => void): this;
	off(event: 'error', listener: (error: Error) => void): this;

	/**
	 * Publish a job state notification (bi-directional communication).
	 * Optional - only implement if the channel supports state notifications.
	 * @param notification - The state notification to publish
	 */
	publishState?(notification: JobStateNotification): Promise<void>;

	/**
	 * Subscribe to job state notifications (bi-directional communication).
	 * Optional - only implement if the channel supports state notifications.
	 * @param handler - Function to call when a state notification is received
	 * @returns Unsubscribe function
	 */
	subscribeState?(handler: StateNotificationHandler): () => void;
}
