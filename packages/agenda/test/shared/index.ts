/**
 * Shared test suites for Agenda backend implementations
 *
 * The recommended way to test a backend is to use fullAgendaTestSuite,
 * which runs all the individual test suites with a single configuration.
 *
 * Usage in a backend package:
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
 *   cleanupBackend: async (backend) => await backend.disconnect(),
 *   clearJobs: async (backend) => await db.collection('agendaJobs').deleteMany({})
 * });
 * ```
 *
 * Individual test suites are also available if you need more control:
 * - repositoryTestSuite - Tests IJobRepository interface compliance
 * - agendaTestSuite - Main Agenda integration tests (includes Job class tests)
 * - notificationChannelTestSuite - Tests INotificationChannel interface
 * - jobProcessorTestSuite - JobProcessor concurrency and stats tests
 * - retryTestSuite - Job retry behavior tests
 */

// Test utilities
export { delay, waitForEvent, waitForEvents } from './test-utils.js';

// Main entry point - runs all test suites
export { fullAgendaTestSuite, type FullAgendaTestConfig } from './full-test-suite.js';

// Individual test suites for fine-grained control
export { repositoryTestSuite, type RepositoryTestConfig } from './repository-test-suite.js';
export {
	notificationChannelTestSuite,
	type NotificationChannelTestConfig
} from './notification-channel-test-suite.js';
export { agendaTestSuite, type AgendaTestConfig, type ForkHelperConfig } from './agenda-test-suite.js';
export { jobProcessorTestSuite, type JobProcessorTestConfig } from './jobprocessor-test-suite.js';
export { retryTestSuite, type RetryTestConfig } from './retry-test-suite.js';
