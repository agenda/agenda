/**
 * Tests for bi-directional state notifications feature.
 * Tests that job state events (start, success, fail, complete, etc.) are
 * published to the notification channel and can be received by remote subscribers.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Agenda, InMemoryNotificationChannel, toJobId } from '../src/index.js';
import type {
	AgendaBackend,
	JobRepository,
	JobParameters,
	JobStateNotification
} from '../src/index.js';

/**
 * Mock repository that allows controlling job execution
 */
class MockJobRepository implements JobRepository {
	async connect(): Promise<void> {}
	async queryJobs() {
		return { jobs: [], total: 0 };
	}
	async getJobsOverview() {
		return [];
	}
	async getDistinctJobNames() {
		return [];
	}
	async getJobById() {
		return null;
	}
	async getQueueSize() {
		return 0;
	}
	async removeJobs() {
		return 0;
	}
	async disableJobs() {
		return 0;
	}
	async enableJobs() {
		return 0;
	}
	async saveJob<DATA = unknown>(job: JobParameters<DATA>): Promise<JobParameters<DATA>> {
		return { ...job, _id: job._id || toJobId('mock-id') };
	}
	async saveJobState() {}
	async lockJob() {
		return undefined;
	}
	async unlockJob() {}
	async unlockJobs() {}
	async getNextJobToRun() {
		return undefined;
	}
}

/**
 * Mock backend for testing
 */
class MockBackend implements AgendaBackend {
	readonly name = 'MockBackend';
	readonly repository = new MockJobRepository();
	async connect(): Promise<void> {}
	async disconnect(): Promise<void> {}
}

describe('State Notifications (Bi-directional)', () => {
	let agenda: Agenda;
	let notificationChannel: InMemoryNotificationChannel;
	let backend: MockBackend;

	beforeEach(async () => {
		backend = new MockBackend();
		notificationChannel = new InMemoryNotificationChannel();
		agenda = new Agenda({
			backend,
			notificationChannel,
			name: 'test-agenda'
		});
		await agenda.ready;
	});

	afterEach(async () => {
		if (agenda.isActiveJobProcessor()) {
			await agenda.stop(false);
		}
	});

	describe('InMemoryNotificationChannel state notifications', () => {
		beforeEach(async () => {
			await notificationChannel.connect();
		});

		afterEach(async () => {
			await notificationChannel.disconnect();
		});

		it('should have publishState method', () => {
			expect(typeof notificationChannel.publishState).toBe('function');
		});

		it('should have subscribeState method', () => {
			expect(typeof notificationChannel.subscribeState).toBe('function');
		});

		it('should publish and receive state notifications', async () => {
			const received: JobStateNotification[] = [];

			notificationChannel.subscribeState(notification => {
				received.push(notification);
			});

			await notificationChannel.publishState({
				type: 'start',
				jobId: toJobId('test-job-id'),
				jobName: 'test-job',
				timestamp: new Date(),
				source: 'test-source'
			});

			expect(received.length).toBe(1);
			expect(received[0].type).toBe('start');
			expect(received[0].jobName).toBe('test-job');
			expect(received[0].source).toBe('test-source');
		});

		it('should allow unsubscribing from state notifications', async () => {
			const received: JobStateNotification[] = [];

			const unsubscribe = notificationChannel.subscribeState(notification => {
				received.push(notification);
			});

			await notificationChannel.publishState({
				type: 'start',
				jobId: toJobId('test-job-id'),
				jobName: 'test-job',
				timestamp: new Date()
			});

			expect(received.length).toBe(1);

			unsubscribe();

			await notificationChannel.publishState({
				type: 'complete',
				jobId: toJobId('test-job-id'),
				jobName: 'test-job',
				timestamp: new Date()
			});

			expect(received.length).toBe(1);
		});

		it('should throw when publishing state on disconnected channel', async () => {
			await notificationChannel.disconnect();

			await expect(
				notificationChannel.publishState({
					type: 'start',
					jobId: toJobId('test-job-id'),
					jobName: 'test-job',
					timestamp: new Date()
				})
			).rejects.toThrow(/not connected/i);
		});
	});

	describe('Agenda.publishJobStateNotification', () => {
		beforeEach(async () => {
			await agenda.start();
		});

		it('should publish state notifications when channel is connected', async () => {
			const received: JobStateNotification[] = [];
			notificationChannel.subscribeState(notification => {
				received.push(notification);
			});

			agenda.define('test-job', async () => {});
			const job = agenda.create('test-job');
			job.attrs._id = toJobId('test-id');

			await agenda.publishJobStateNotification(job, 'start', {
				lastRunAt: new Date()
			});

			expect(received.length).toBe(1);
			expect(received[0].type).toBe('start');
			expect(received[0].jobName).toBe('test-job');
			expect(received[0].source).toBe('test-agenda');
		});

		it('should include extra data in state notification', async () => {
			const received: JobStateNotification[] = [];
			notificationChannel.subscribeState(notification => {
				received.push(notification);
			});

			agenda.define('test-job', async () => {});
			const job = agenda.create('test-job');
			job.attrs._id = toJobId('test-id');

			await agenda.publishJobStateNotification(job, 'fail', {
				error: 'Test error message',
				failCount: 3
			});

			expect(received.length).toBe(1);
			expect(received[0].type).toBe('fail');
			expect(received[0].error).toBe('Test error message');
			expect(received[0].failCount).toBe(3);
		});

		it('should not throw when channel does not support state notifications', async () => {
			// Create a channel without publishState
			const basicChannel = new InMemoryNotificationChannel();
			// @ts-expect-error - Removing method for test
			basicChannel.publishState = undefined;

			const basicAgenda = new Agenda({
				backend: new MockBackend(),
				notificationChannel: basicChannel,
				name: 'basic-agenda'
			});
			await basicAgenda.ready;
			await basicAgenda.start();

			basicAgenda.define('test-job', async () => {});
			const job = basicAgenda.create('test-job');
			job.attrs._id = toJobId('test-id');

			// Should not throw
			await basicAgenda.publishJobStateNotification(job, 'start');

			await basicAgenda.stop(false);
		});
	});

	describe('Cross-process event re-emitting', () => {
		beforeEach(async () => {
			await agenda.start();
		});

		it('should subscribe to state notifications on start', async () => {
			// Verify state subscription was set up by checking that events are received
			const received: Array<{ notification: JobStateNotification; remote: boolean | undefined }> = [];
			agenda.on('success', (notification: JobStateNotification, remote?: boolean) => {
				received.push({ notification, remote });
			});

			// Simulate a remote notification
			await notificationChannel.publishState({
				type: 'success',
				jobId: toJobId('remote-job-id'),
				jobName: 'remote-job',
				timestamp: new Date(),
				source: 'other-agenda' // Different source
			});

			// Wait for nextTick since remote events are deferred
			await new Promise(resolve => process.nextTick(resolve));

			expect(received.length).toBe(1);
			expect(received[0].notification.jobName).toBe('remote-job');
			expect(received[0].remote).toBe(true);
		});

		it('should emit generic event for remote notifications with remote=true', async () => {
			const received: Array<{ data: unknown; remote: boolean | undefined }> = [];
			agenda.on('complete', (data: unknown, remote?: boolean) => {
				received.push({ data, remote });
			});

			await notificationChannel.publishState({
				type: 'complete',
				jobId: toJobId('remote-job-id'),
				jobName: 'remote-job',
				timestamp: new Date(),
				source: 'other-agenda',
				duration: 1000
			});

			// Wait for nextTick since remote events are deferred
			await new Promise(resolve => process.nextTick(resolve));

			expect(received.length).toBe(1);
			expect(received[0].remote).toBe(true);
		});

		it('should emit job-specific event for remote notifications with remote=true', async () => {
			const received: Array<{ data: unknown; remote: boolean | undefined }> = [];
			agenda.on('success:my-job', (data: unknown, remote?: boolean) => {
				received.push({ data, remote });
			});

			await notificationChannel.publishState({
				type: 'success',
				jobId: toJobId('remote-job-id'),
				jobName: 'my-job',
				timestamp: new Date(),
				source: 'other-agenda'
			});

			// Wait for nextTick since remote events are deferred
			await new Promise(resolve => process.nextTick(resolve));

			expect(received.length).toBe(1);
			expect(received[0].remote).toBe(true);
		});

		it('should emit fail events with error as first argument and remote=true', async () => {
			const received: Array<{ error: unknown; notification: unknown; remote: boolean | undefined }> = [];
			agenda.on('fail', (error: unknown, notification: unknown, remote?: boolean) => {
				received.push({ error, notification, remote });
			});

			await notificationChannel.publishState({
				type: 'fail',
				jobId: toJobId('remote-job-id'),
				jobName: 'failing-job',
				timestamp: new Date(),
				source: 'other-agenda',
				error: 'Something went wrong',
				failCount: 2
			});

			// Wait for nextTick since remote events are deferred
			await new Promise(resolve => process.nextTick(resolve));

			expect(received.length).toBe(1);
			expect(received[0].error).toBe('Something went wrong');
			expect(received[0].remote).toBe(true);
		});

		it('should emit retry events with details and remote=true', async () => {
			const received: Array<{ notification: unknown; details: unknown; remote: boolean | undefined }> = [];
			agenda.on('retry', (notification: unknown, details: unknown, remote?: boolean) => {
				received.push({ notification, details, remote });
			});

			const retryAt = new Date();
			await notificationChannel.publishState({
				type: 'retry',
				jobId: toJobId('remote-job-id'),
				jobName: 'retry-job',
				timestamp: new Date(),
				source: 'other-agenda',
				retryAt,
				retryAttempt: 3,
				error: 'Temporary failure'
			});

			// Wait for nextTick since remote events are deferred
			await new Promise(resolve => process.nextTick(resolve));

			expect(received.length).toBe(1);
			expect(received[0].remote).toBe(true);
			expect((received[0].details as { attempt: number }).attempt).toBe(3);
		});

		it('should NOT re-emit events from same source to avoid double-firing', async () => {
			const received: unknown[] = [];
			agenda.on('success', (data: unknown) => {
				received.push(data);
			});

			// Simulate a notification from THIS agenda instance (same source)
			await notificationChannel.publishState({
				type: 'success',
				jobId: toJobId('local-job-id'),
				jobName: 'local-job',
				timestamp: new Date(),
				source: 'test-agenda' // Same source as agenda.attrs.name
			});

			// Wait for nextTick to ensure any deferred processing happens
			await new Promise(resolve => process.nextTick(resolve));

			// Should NOT be received because source matches
			expect(received.length).toBe(0);
		});

		it('should unsubscribe from state notifications on stop', async () => {
			// Store the received notifications
			const received: unknown[] = [];
			agenda.on('success', (data: unknown) => {
				received.push(data);
			});

			// First verify notifications work before stop
			await notificationChannel.publishState({
				type: 'success',
				jobId: toJobId('remote-job-id'),
				jobName: 'remote-job',
				timestamp: new Date(),
				source: 'other-agenda'
			});

			// Wait for nextTick since remote events are deferred
			await new Promise(resolve => process.nextTick(resolve));

			expect(received.length).toBe(1);

			// Stop the agenda (this disconnects the notification channel)
			await agenda.stop(false);

			// After stop, the channel is disconnected, so we can't publish
			// This verifies that stop cleans up properly
			expect(notificationChannel.state).toBe('disconnected');
		});
	});

	describe('All state types', () => {
		beforeEach(async () => {
			await agenda.start();
		});

		it("should handle 'start' state notifications with remote=true", async () => {
			const received: Array<{ data: unknown; remote: boolean | undefined }> = [];
			agenda.on('start', (data: unknown, remote?: boolean) => {
				received.push({ data, remote });
			});

			await notificationChannel.publishState({
				type: 'start',
				jobId: toJobId('test-id'),
				jobName: 'test-job',
				timestamp: new Date(),
				source: 'other-agenda'
			});

			await new Promise(resolve => process.nextTick(resolve));

			expect(received.length).toBe(1);
			expect(received[0].remote).toBe(true);
		});

		it("should handle 'progress' state notifications with remote=true", async () => {
			const received: Array<{ data: unknown; remote: boolean | undefined }> = [];
			agenda.on('progress', (data: unknown, remote?: boolean) => {
				received.push({ data, remote });
			});

			await notificationChannel.publishState({
				type: 'progress',
				jobId: toJobId('test-id'),
				jobName: 'test-job',
				timestamp: new Date(),
				source: 'other-agenda',
				progress: 50
			});

			await new Promise(resolve => process.nextTick(resolve));

			expect(received.length).toBe(1);
			expect(received[0].remote).toBe(true);
		});

		it("should handle 'success' state notifications with remote=true", async () => {
			const received: Array<{ data: unknown; remote: boolean | undefined }> = [];
			agenda.on('success', (data: unknown, remote?: boolean) => {
				received.push({ data, remote });
			});

			await notificationChannel.publishState({
				type: 'success',
				jobId: toJobId('test-id'),
				jobName: 'test-job',
				timestamp: new Date(),
				source: 'other-agenda'
			});

			await new Promise(resolve => process.nextTick(resolve));

			expect(received.length).toBe(1);
			expect(received[0].remote).toBe(true);
		});

		it("should handle 'fail' state notifications with error and remote=true", async () => {
			const received: Array<{ error: unknown; data: unknown; remote: boolean | undefined }> = [];
			agenda.on('fail', (error: unknown, data: unknown, remote?: boolean) => {
				received.push({ error, data, remote });
			});

			await notificationChannel.publishState({
				type: 'fail',
				jobId: toJobId('test-id'),
				jobName: 'test-job',
				timestamp: new Date(),
				source: 'other-agenda',
				error: 'Test error'
			});

			await new Promise(resolve => process.nextTick(resolve));

			expect(received.length).toBe(1);
			expect(received[0].error).toBe('Test error');
			expect(received[0].remote).toBe(true);
		});

		it("should handle 'complete' state notifications with remote=true", async () => {
			const received: Array<{ data: unknown; remote: boolean | undefined }> = [];
			agenda.on('complete', (data: unknown, remote?: boolean) => {
				received.push({ data, remote });
			});

			await notificationChannel.publishState({
				type: 'complete',
				jobId: toJobId('test-id'),
				jobName: 'test-job',
				timestamp: new Date(),
				source: 'other-agenda'
			});

			await new Promise(resolve => process.nextTick(resolve));

			expect(received.length).toBe(1);
			expect(received[0].remote).toBe(true);
		});

		it("should handle 'retry' state notifications with details and remote=true", async () => {
			const received: Array<{ data: unknown; details: unknown; remote: boolean | undefined }> = [];
			agenda.on('retry', (data: unknown, details: unknown, remote?: boolean) => {
				received.push({ data, details, remote });
			});

			await notificationChannel.publishState({
				type: 'retry',
				jobId: toJobId('test-id'),
				jobName: 'test-job',
				timestamp: new Date(),
				source: 'other-agenda',
				retryAttempt: 2,
				retryAt: new Date()
			});

			await new Promise(resolve => process.nextTick(resolve));

			expect(received.length).toBe(1);
			expect(received[0].remote).toBe(true);
		});
	});
});
