import { expect, describe, it, beforeEach, afterEach } from 'vitest';
import { Db } from 'mongodb';
import { Agenda, InMemoryNotificationChannel, IJobNotification, toJobId } from '../src';
import { MongoBackend } from '@agenda.js/mongo-backend';
import { mockMongo } from './helpers/mock-mongodb';

let agenda: Agenda;
let mongoDb: Db;

const clearJobs = async () => {
	if (mongoDb) {
		await mongoDb.collection('agendaJobs').deleteMany({});
	}
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('Notification Channel', () => {
	beforeEach(async () => {
		if (!mongoDb) {
			const mockedMongo = await mockMongo();
			mongoDb = mockedMongo.db;
		}
		await clearJobs();
	});

	afterEach(async () => {
		if (agenda) {
			await agenda.stop();
		}
		await clearJobs();
	});

	describe('InMemoryNotificationChannel', () => {
		it('should publish and receive notifications', async () => {
			const channel = new InMemoryNotificationChannel();
			const receivedNotifications: IJobNotification[] = [];

			await channel.connect();
			expect(channel.state).to.equal('connected');

			channel.subscribe(notification => {
				receivedNotifications.push(notification);
			});

			await channel.publish({
				jobId: toJobId('test-id'),
				jobName: 'test-job',
				nextRunAt: new Date(),
				priority: 0,
				timestamp: new Date()
			});

			expect(receivedNotifications).to.have.length(1);
			expect(receivedNotifications[0].jobName).to.equal('test-job');

			await channel.disconnect();
			expect(channel.state).to.equal('disconnected');
		});

		it('should throw when publishing on disconnected channel', async () => {
			const channel = new InMemoryNotificationChannel();

			try {
				await channel.publish({
					jobId: toJobId('test-id'),
					jobName: 'test-job',
					nextRunAt: new Date(),
					priority: 0,
					timestamp: new Date()
				});
				expect.fail('Should have thrown');
			} catch (error) {
				expect((error as Error).message).to.equal('Cannot publish: channel not connected');
			}
		});

		it('should allow unsubscribing', async () => {
			const channel = new InMemoryNotificationChannel();
			const receivedNotifications: IJobNotification[] = [];

			await channel.connect();

			const unsubscribe = channel.subscribe(notification => {
				receivedNotifications.push(notification);
			});

			await channel.publish({
				jobId: toJobId('test-id'),
				jobName: 'test-job-1',
				nextRunAt: new Date(),
				priority: 0,
				timestamp: new Date()
			});

			expect(receivedNotifications).to.have.length(1);

			// Unsubscribe
			unsubscribe();

			await channel.publish({
				jobId: toJobId('test-id'),
				jobName: 'test-job-2',
				nextRunAt: new Date(),
				priority: 0,
				timestamp: new Date()
			});

			// Should still only have 1 notification
			expect(receivedNotifications).to.have.length(1);

			await channel.disconnect();
		});
	});

	describe('Agenda with notification channel', () => {
		it('should accept notification channel in constructor', async () => {
			const channel = new InMemoryNotificationChannel();

			agenda = new Agenda({
				backend: new MongoBackend({ mongo: mongoDb }),
				notificationChannel: channel
			});

			expect(agenda.hasNotificationChannel()).to.equal(true);
		});

		it('should accept notification channel via notifyVia method', async () => {
			const channel = new InMemoryNotificationChannel();

			agenda = new Agenda({ backend: new MongoBackend({ mongo: mongoDb }) });
			expect(agenda.hasNotificationChannel()).to.equal(false);

			agenda.notifyVia(channel);
			expect(agenda.hasNotificationChannel()).to.equal(true);
		});

		it('should throw when setting notification channel after start', async () => {
			const channel = new InMemoryNotificationChannel();

			agenda = new Agenda({ backend: new MongoBackend({ mongo: mongoDb }) });
			agenda.define('test', async () => {});
			await agenda.start();

			try {
				agenda.notifyVia(channel);
				expect.fail('Should have thrown');
			} catch (error) {
				expect((error as Error).message).to.contain('job processor is already running');
			}
		});

		it('should connect and disconnect notification channel on start/stop', async () => {
			const channel = new InMemoryNotificationChannel();

			agenda = new Agenda({
				backend: new MongoBackend({ mongo: mongoDb }),
				notificationChannel: channel
			});

			expect(channel.state).to.equal('disconnected');

			agenda.define('test', async () => {});
			await agenda.start();

			expect(channel.state).to.equal('connected');

			await agenda.stop();

			expect(channel.state).to.equal('disconnected');
		});

		it('should process jobs faster with notification channel', async () => {
			const channel = new InMemoryNotificationChannel();
			let jobProcessed = false;

			// Create agenda with long processEvery but with notification channel
			agenda = new Agenda({
				backend: new MongoBackend({ mongo: mongoDb }),
				processEvery: 10000, // 10 seconds - way longer than our test
				notificationChannel: channel
			});

			agenda.define('fast-job', async () => {
				jobProcessed = true;
			});

			await agenda.start();

			// Schedule a job - notification should trigger immediate processing
			await agenda.now('fast-job');

			// Wait a short time for notification-based processing
			await delay(500);

			expect(jobProcessed).to.equal(true);
		});
	});
});
