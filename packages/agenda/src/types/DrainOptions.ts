/**
 * Options for the drain() method
 */
export interface DrainOptions {
	/**
	 * Maximum time in milliseconds to wait for jobs to complete.
	 * If not specified, drain() will wait indefinitely.
	 */
	timeout?: number;

	/**
	 * AbortSignal to cancel the drain operation.
	 * When aborted, drain() will resolve immediately with the current state.
	 */
	signal?: AbortSignal;
}

/**
 * Result of the drain() operation
 */
export interface DrainResult {
	/**
	 * Number of jobs that completed during the drain
	 */
	completed: number;

	/**
	 * Number of jobs still running when drain finished
	 * (only non-zero if timeout was hit or signal was aborted)
	 */
	running: number;

	/**
	 * Whether the drain finished because the timeout was reached
	 */
	timedOut: boolean;

	/**
	 * Whether the drain finished because the signal was aborted
	 */
	aborted: boolean;
}