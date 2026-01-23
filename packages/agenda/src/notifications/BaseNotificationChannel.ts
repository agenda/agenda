import { EventEmitter } from 'events';
import type {
	INotificationChannel,
	INotificationChannelConfig,
	IJobNotification,
	NotificationHandler,
	NotificationChannelState
} from '../types/NotificationChannel.js';

/**
 * Internal config type with all properties required
 */
interface IResolvedNotificationChannelConfig {
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
export abstract class BaseNotificationChannel extends EventEmitter implements INotificationChannel {
	protected _state: NotificationChannelState = 'disconnected';
	protected handlers = new Set<NotificationHandler>();
	protected reconnectAttempts = 0;
	protected reconnectTimeout?: ReturnType<typeof setTimeout>;

	protected readonly config: IResolvedNotificationChannelConfig;

	constructor(config: INotificationChannelConfig = {}) {
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
	abstract publish(notification: IJobNotification): Promise<void>;

	subscribe(handler: NotificationHandler): () => void {
		this.handlers.add(handler);
		return () => {
			this.handlers.delete(handler);
		};
	}

	protected async notifyHandlers(notification: IJobNotification): Promise<void> {
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
