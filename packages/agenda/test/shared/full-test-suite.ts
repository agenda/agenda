/**
 * Full Agenda test suite that runs all shared test suites
 *
 * This is the recommended way to test a backend implementation.
 * It runs all the individual test suites (repository, agenda, job, etc.)
 * with a single configuration.
 *
 * Usage:
 * ```typescript
 * import { fullAgendaTestSuite } from 'agenda/test/shared';
 *
 * fullAgendaTestSuite({
 *   name: 'MongoDB',
 *   createBackend: async () => {
 *     const backend = new MongoBackend({ mongo: db });
 *     await backend.connect();
 *     return backend;
 *   },
 *   cleanupBackend: async (backend) => {
 *     await backend.disconnect();
 *   },
 *   clearJobs: async (backend) => {
 *     await db.collection('agendaJobs').deleteMany({});
 *   }
 * });
 * ```
 */

import type { IAgendaBackend, INotificationChannel } from '../../src/index.js';
import { repositoryTestSuite } from './repository-test-suite.js';
import { agendaTestSuite, type ForkHelperConfig } from './agenda-test-suite.js';
import { jobProcessorTestSuite } from './jobprocessor-test-suite.js';
import { retryTestSuite } from './retry-test-suite.js';

export interface FullAgendaTestConfig {
	/** Name for the test suite (e.g., 'MongoDB', 'PostgreSQL') */
	name: string;
	/** Factory to create a fresh backend instance */
	createBackend: () => Promise<IAgendaBackend>;
	/** Cleanup function called after tests */
	cleanupBackend: (backend: IAgendaBackend) => Promise<void>;
	/** Clear all jobs between tests */
	clearJobs: (backend: IAgendaBackend) => Promise<void>;
	/** Optional notification channel factory for testing notification integration */
	createNotificationChannel?: () => Promise<INotificationChannel>;
	/** Cleanup notification channel */
	cleanupNotificationChannel?: (channel: INotificationChannel) => Promise<void>;
	/** Fork mode configuration (backend-specific fork helper) */
	forkHelper?: ForkHelperConfig;
	/** Skip specific test suites */
	skip?: {
		repository?: boolean;
		agenda?: boolean;
		jobProcessor?: boolean;
		retry?: boolean;
		forkMode?: boolean;
	};
}

/**
 * Runs the full Agenda test suite for a backend implementation
 *
 * This includes:
 * - Repository tests (IJobRepository interface compliance)
 * - Agenda integration tests (scheduling, processing, events, Job class)
 * - JobProcessor tests (concurrency, locking, stats)
 * - Retry tests (job retry behavior)
 */
export function fullAgendaTestSuite(config: FullAgendaTestConfig): void {
	const skip = config.skip ?? {};

	// Repository tests
	if (!skip.repository) {
		repositoryTestSuite({
			name: `${config.name} Repository`,
			createRepository: async () => {
				const backend = await config.createBackend();
				return backend.repository;
			},
			cleanupRepository: async () => {
				// Backend cleanup handles this
			}
			// clearJobs not passed - repositoryTestSuite uses removeJobs as default
		});
	}

	// Main Agenda integration tests
	if (!skip.agenda) {
		agendaTestSuite({
			name: config.name,
			createBackend: config.createBackend,
			cleanupBackend: config.cleanupBackend,
			clearJobs: config.clearJobs,
			createNotificationChannel: config.createNotificationChannel,
			cleanupNotificationChannel: config.cleanupNotificationChannel,
			forkHelper: config.forkHelper,
			skip: {
				forkMode: skip.forkMode
			}
		});
	}

	// JobProcessor tests
	if (!skip.jobProcessor) {
		jobProcessorTestSuite({
			name: config.name,
			createBackend: config.createBackend,
			cleanupBackend: config.cleanupBackend,
			clearJobs: config.clearJobs
		});
	}

	// Retry tests
	if (!skip.retry) {
		retryTestSuite({
			name: config.name,
			createBackend: config.createBackend,
			cleanupBackend: config.cleanupBackend,
			clearJobs: config.clearJobs
		});
	}
}