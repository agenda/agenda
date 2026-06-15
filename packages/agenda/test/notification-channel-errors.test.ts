import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InMemoryNotificationChannel, toJobId } from '../src/index.js';
import type { JobNotification } from '../src/index.js';

const notification = (): JobNotification => ({
	jobId: toJobId('1'),
	jobName: 'test',
	nextRunAt: null,
	priority: 0
});

describe('BaseNotificationChannel handler errors', () => {
	let channel: InMemoryNotificationChannel;

	beforeEach(async () => {
		channel = new InMemoryNotificationChannel();
		await channel.connect();
	});

	afterEach(async () => {
		await channel.disconnect();
	});

	it('emits error when an async handler rejects and still runs other handlers', async () => {
		const errors: Error[] = [];
		channel.on('error', err => errors.push(err as Error));

		const ran: string[] = [];
		channel.subscribe(async () => {
			throw new Error('async boom');
		});
		channel.subscribe(() => {
			ran.push('second');
		});

		await channel.publish(notification());

		expect(errors).toHaveLength(1);
		expect(errors[0].message).toBe('async boom');
		expect(ran).toEqual(['second']);
	});

	it('emits error when a sync handler throws', async () => {
		const errors: Error[] = [];
		channel.on('error', err => errors.push(err as Error));

		channel.subscribe(() => {
			throw new Error('sync boom');
		});

		await channel.publish(notification());

		expect(errors).toHaveLength(1);
		expect(errors[0].message).toBe('sync boom');
	});
});
