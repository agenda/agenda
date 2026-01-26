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
}
