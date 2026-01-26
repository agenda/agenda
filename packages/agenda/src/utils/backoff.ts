/**
 * Backoff strategy utilities for job retry logic
 */

/**
 * Context passed to backoff strategy functions
 */
export interface BackoffContext {
	/** Current attempt number (1-based, so first retry is attempt 1) */
	attempt: number;
	/** The error that caused the failure */
	error: Error;
	/** Job name */
	jobName: string;
	/** Job data */
	jobData: unknown;
}

/**
 * A backoff strategy is a function that returns the delay in milliseconds
 * before the next retry attempt, or `null` to stop retrying.
 */
export type BackoffStrategy = (context: BackoffContext) => number | null;

/**
 * Options for built-in backoff strategies
 */
export interface BackoffOptions {
	/** Initial delay in milliseconds (default: 1000) */
	delay?: number;
	/** Maximum delay in milliseconds (default: Infinity) */
	maxDelay?: number;
	/** Maximum number of retry attempts (default: 3) */
	maxRetries?: number;
	/** Add randomness to prevent thundering herd (default: 0, range: 0-1) */
	jitter?: number;
}

/**
 * Options specific to exponential backoff
 */
export interface ExponentialBackoffOptions extends BackoffOptions {
	/** Multiplier for each attempt (default: 2) */
	factor?: number;
}

/**
 * Options specific to linear backoff
 */
export interface LinearBackoffOptions extends BackoffOptions {
	/** Amount to increase delay by each attempt (default: same as delay) */
	increment?: number;
}

/**
 * Apply jitter to a delay value
 * @param delay - Base delay in milliseconds
 * @param jitter - Jitter factor (0-1), where 0 means no jitter and 1 means up to ±100%
 * @returns Delay with jitter applied
 */
function applyJitter(delay: number, jitter: number): number {
	if (jitter <= 0) return delay;
	// Random value between -jitter and +jitter
	const jitterAmount = delay * jitter * (Math.random() * 2 - 1);
	return Math.max(0, Math.round(delay + jitterAmount));
}

/**
 * Constant backoff - same delay between each retry
 *
 * @example
 * ```ts
 * agenda.define('myJob', handler, {
 *   backoff: constant({ delay: 5000, maxRetries: 5 })
 * });
 * // Retries at: 5s, 5s, 5s, 5s, 5s
 * ```
 */
export function constant(options: BackoffOptions = {}): BackoffStrategy {
	const { delay = 1000, maxDelay = Infinity, maxRetries = 3, jitter = 0 } = options;

	return (context: BackoffContext): number | null => {
		if (context.attempt > maxRetries) {
			return null;
		}
		const baseDelay = Math.min(delay, maxDelay);
		return applyJitter(baseDelay, jitter);
	};
}

/**
 * Linear backoff - delay increases by a fixed amount each retry
 *
 * @example
 * ```ts
 * agenda.define('myJob', handler, {
 *   backoff: linear({ delay: 1000, increment: 2000, maxRetries: 4 })
 * });
 * // Retries at: 1s, 3s, 5s, 7s
 * ```
 */
export function linear(options: LinearBackoffOptions = {}): BackoffStrategy {
	const {
		delay = 1000,
		increment = delay,
		maxDelay = Infinity,
		maxRetries = 3,
		jitter = 0
	} = options;

	return (context: BackoffContext): number | null => {
		if (context.attempt > maxRetries) {
			return null;
		}
		const baseDelay = delay + increment * (context.attempt - 1);
		const cappedDelay = Math.min(baseDelay, maxDelay);
		return applyJitter(cappedDelay, jitter);
	};
}

/**
 * Exponential backoff - delay multiplies by a factor each retry
 *
 * @example
 * ```ts
 * agenda.define('myJob', handler, {
 *   backoff: exponential({ delay: 1000, factor: 2, maxRetries: 5 })
 * });
 * // Retries at: 1s, 2s, 4s, 8s, 16s
 *
 * // With jitter to prevent thundering herd:
 * agenda.define('myJob', handler, {
 *   backoff: exponential({ delay: 1000, factor: 2, maxRetries: 5, jitter: 0.2 })
 * });
 * ```
 */
export function exponential(options: ExponentialBackoffOptions = {}): BackoffStrategy {
	const { delay = 1000, factor = 2, maxDelay = Infinity, maxRetries = 3, jitter = 0 } = options;

	return (context: BackoffContext): number | null => {
		if (context.attempt > maxRetries) {
			return null;
		}
		const baseDelay = delay * Math.pow(factor, context.attempt - 1);
		const cappedDelay = Math.min(baseDelay, maxDelay);
		return applyJitter(cappedDelay, jitter);
	};
}

/**
 * Combine multiple strategies - tries each in sequence until one returns non-null
 * Useful for implementing complex retry logic
 *
 * @example
 * ```ts
 * // Retry quickly at first, then back off
 * agenda.define('myJob', handler, {
 *   backoff: combine(
 *     // First 2 retries: immediate (100ms)
 *     (ctx) => ctx.attempt <= 2 ? 100 : null,
 *     // Then exponential backoff for 3 more attempts
 *     exponential({ delay: 1000, maxRetries: 3 })
 *   )
 * });
 * ```
 */
export function combine(...strategies: BackoffStrategy[]): BackoffStrategy {
	return (context: BackoffContext): number | null => {
		for (const strategy of strategies) {
			const result = strategy(context);
			if (result !== null) {
				return result;
			}
		}
		return null;
	};
}

/**
 * Conditional backoff - only retry if condition is met
 *
 * @example
 * ```ts
 * // Only retry on specific errors
 * agenda.define('myJob', handler, {
 *   backoff: when(
 *     (ctx) => ctx.error.message.includes('timeout'),
 *     exponential({ delay: 1000, maxRetries: 3 })
 *   )
 * });
 * ```
 */
export function when(
	condition: (context: BackoffContext) => boolean,
	strategy: BackoffStrategy
): BackoffStrategy {
	return (context: BackoffContext): number | null => {
		if (!condition(context)) {
			return null;
		}
		return strategy(context);
	};
}

/**
 * Pre-configured backoff strategies for common use cases
 */
export const backoffStrategies = {
	/** Constant 1s delay, 3 retries */
	constant,
	/** Linear increase starting at 1s, 3 retries */
	linear,
	/** Exponential with factor 2, starting at 1s, 3 retries */
	exponential,
	/** Combine multiple strategies */
	combine,
	/** Conditional retry */
	when,

	/**
	 * Aggressive retry - quick retries for transient failures
	 * 100ms, 200ms, 400ms (3 retries in ~700ms total)
	 */
	aggressive: (): BackoffStrategy =>
		exponential({ delay: 100, factor: 2, maxRetries: 3 }),

	/**
	 * Relaxed retry - gentle backoff for rate-limited APIs
	 * 5s, 15s, 45s, 135s (4 retries over ~3 minutes)
	 */
	relaxed: (): BackoffStrategy =>
		exponential({ delay: 5000, factor: 3, maxRetries: 4, jitter: 0.1 }),

	/**
	 * Standard retry - balanced approach
	 * 1s, 2s, 4s, 8s, 16s (5 retries over ~31 seconds)
	 */
	standard: (): BackoffStrategy =>
		exponential({ delay: 1000, factor: 2, maxRetries: 5, jitter: 0.1 })
};
