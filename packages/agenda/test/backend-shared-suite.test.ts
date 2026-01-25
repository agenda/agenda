/**
 * Tests for InMemoryNotificationChannel using the shared test suite
 *
 * MongoDB repository tests have been moved to @agenda.js/mongo-backend package.
 */

import { InMemoryNotificationChannel } from '../src';
import { notificationChannelTestSuite } from './shared';

// ============================================================================
// InMemoryNotificationChannel Tests using Shared Suite
// ============================================================================

notificationChannelTestSuite({
	name: 'InMemoryNotificationChannel',
	createChannel: async () => {
		return new InMemoryNotificationChannel();
	},
	cleanupChannel: async channel => {
		if (channel.state !== 'disconnected') {
			await channel.disconnect();
		}
	},
	propagationDelay: 50 // In-memory is fast
});
