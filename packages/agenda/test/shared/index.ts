/**
 * Shared test suites for Agenda backend implementations
 *
 * These test suites can be used to verify that any IJobRepository or
 * INotificationChannel implementation correctly implements the interfaces.
 *
 * Usage in a backend package:
 * ```typescript
 * import { repositoryTestSuite, notificationChannelTestSuite } from 'agenda/test/shared';
 *
 * repositoryTestSuite({
 *   name: 'MyJobRepository',
 *   createRepository: async () => new MyRepository(),
 *   cleanupRepository: async (repo) => await repo.disconnect()
 * });
 *
 * notificationChannelTestSuite({
 *   name: 'MyNotificationChannel',
 *   createChannel: async () => new MyChannel(),
 *   cleanupChannel: async (channel) => await channel.disconnect()
 * });
 * ```
 */

export { repositoryTestSuite, type RepositoryTestConfig } from './repository-test-suite.js';
export {
	notificationChannelTestSuite,
	type NotificationChannelTestConfig
} from './notification-channel-test-suite.js';
