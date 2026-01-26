import type {
	NotificationChannelConfig,
	JobNotification
} from '../types/NotificationChannel.js';
import { BaseNotificationChannel } from './BaseNotificationChannel.js';

/**
 * In-memory notification channel for testing and single-process scenarios.
 * Notifications are delivered synchronously within the same process.
 */
export class InMemoryNotificationChannel extends BaseNotificationChannel {
	constructor(config: NotificationChannelConfig = {}) {
		super(config);
	}

	async connect(): Promise<void> {
		this.clearReconnect();
		this.setState('connected');
	}

	async disconnect(): Promise<void> {
		this.clearReconnect();
		this.handlers.clear();
		this.setState('disconnected');
	}

	async publish(notification: JobNotification): Promise<void> {
		if (this._state !== 'connected') {
			throw new Error('Cannot publish: channel not connected');
		}
		await this.notifyHandlers(notification);
	}
}
