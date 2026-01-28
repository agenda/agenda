import { EventEmitter } from 'events';
import type {
	NotificationChannel,
	NotificationChannelConfig,
	JobNotification,
	NotificationHandler,
	NotificationChannelState,
	JobStateNotification,
	StateNotificationHandler
} from '../types/NotificationChannel.js';

/**
 * Internal config type with all properties required
 */
interface ResolvedNotificationChannelConfig {
	channelName: string;
	reconnect: {
		enabled: boolean;
		maxAttempts: number;
		initialDelayMs: number;
		maxDelayMs: number;
	};
}

/**
 * Abstract base class for notification channels.
 * Provides common functionality like state management and reconnection logic.
 */
export abstract class BaseNotificationChannel extends EventEmitter implements NotificationChannel {
	protected _state: NotificationChannelState = 'disconnected';
	protected handlers = new Set<NotificationHandler>();
	protected stateHandlers = new Set<StateNotificationHandler>();
	protected reconnectAttempts = 0;
	protected reconnectTimeout?: ReturnType<typeof setTimeout>;

	protected readonly config: ResolvedNotificationChannelConfig;

	constructor(config: NotificationChannelConfig = {}) {
		super();
		this.config = {
			channelName: config.channelName ?? 'agenda:jobs',
			reconnect: {
				enabled: config.reconnect?.enabled ?? true,
				maxAttempts: config.reconnect?.maxAttempts ?? 10,
				initialDelayMs: config.reconnect?.initialDelayMs ?? 100,
				maxDelayMs: config.reconnect?.maxDelayMs ?? 30000
			}
		};
	}

	get state(): NotificationChannelState {
		return this._state;
	}

	protected setState(newState: NotificationChannelState): void {
		if (this._state !== newState) {
			this._state = newState;
			this.emit('stateChange', newState);
		}
	}

	abstract connect(): Promise<void>;
	abstract disconnect(): Promise<void>;
	abstract publish(notification: JobNotification): Promise<void>;

	subscribe(handler: NotificationHandler): () => void {
		this.handlers.add(handler);
		return () => {
			this.handlers.delete(handler);
		};
	}

	protected async notifyHandlers(notification: JobNotification): Promise<void> {
		const promises: Promise<void>[] = [];
		for (const handler of this.handlers) {
			try {
				const result = handler(notification);
				if (result instanceof Promise) {
					promises.push(result);
				}
			} catch (error) {
				this.emit('error', error);
			}
		}
		await Promise.allSettled(promises);
	}

	/**
	 * Notify all registered state handlers of a state notification.
	 * Subclasses should call this when receiving state notifications.
	 */
	protected async notifyStateHandlers(notification: JobStateNotification): Promise<void> {
		const promises: Promise<void>[] = [];
		for (const handler of this.stateHandlers) {
			try {
				const result = handler(notification);
				if (result instanceof Promise) {
					promises.push(result);
				}
			} catch (error) {
				this.emit('error', error);
			}
		}
		await Promise.allSettled(promises);
	}

	/**
	 * Subscribe to state notifications.
	 * Default implementation manages the stateHandlers set.
	 */
	subscribeState(handler: StateNotificationHandler): () => void {
		this.stateHandlers.add(handler);
		return () => {
			this.stateHandlers.delete(handler);
		};
	}

	protected scheduleReconnect(): void {
		if (!this.config.reconnect.enabled) {
			return;
		}

		if (this.reconnectAttempts >= this.config.reconnect.maxAttempts) {
			this.setState('error');
			this.emit('error', new Error('Max reconnection attempts reached'));
			return;
		}

		const delay = Math.min(
			this.config.reconnect.initialDelayMs * Math.pow(2, this.reconnectAttempts),
			this.config.reconnect.maxDelayMs
		);

		this.setState('reconnecting');
		this.reconnectAttempts++;

		this.reconnectTimeout = setTimeout(() => {
			this.connect().catch(error => {
				this.emit('error', error);
			});
		}, delay);
	}

	protected clearReconnect(): void {
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = undefined;
		}
		this.reconnectAttempts = 0;
	}
}
