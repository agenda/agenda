import { describe, it, expect } from 'vitest';
import { JobProcessingQueue } from '../src/JobProcessingQueue.js';

function fakeAgenda(names: string[]) {
	const definitions: Record<string, unknown> = {};
	for (const n of names) {
		definitions[n] = { concurrency: 10, lockLimit: 0 };
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal stub for queue
	return { definitions } as any;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal job-like stub
function mkJob(id: string, name: string, nextRunAt: Date, priority: number): any {
	return { attrs: { _id: id, name, nextRunAt, priority } };
}

/** Drain the queue in the order the processor would actually run the jobs. */
function drainOrder(q: JobProcessingQueue): string[] {
	const order: string[] = [];
	for (;;) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- private method access for test
		const job = (q as any).returnNextConcurrencyFreeJob({}, []);
		if (!job) break;
		order.push(job.attrs._id);
		q.remove(job);
	}
	return order;
}

describe('JobProcessingQueue insertion ordering', () => {
	it('runs the higher-priority job first for equal nextRunAt, regardless of insert order', () => {
		const agenda = fakeAgenda(['task']);
		const t = new Date('2024-01-01T00:00:00Z');

		const q1 = new JobProcessingQueue(agenda);
		q1.insert(mkJob('low', 'task', t, 0));
		q1.insert(mkJob('high', 'task', t, 10));

		const q2 = new JobProcessingQueue(agenda);
		q2.insert(mkJob('high', 'task', t, 10));
		q2.insert(mkJob('low', 'task', t, 0));

		expect(drainOrder(q1)[0]).toBe('high');
		expect(drainOrder(q2)[0]).toBe('high');
	});

	it('runs the earlier nextRunAt before the later one', () => {
		const agenda = fakeAgenda(['task']);
		const early = new Date('2024-01-01T00:00:00Z');
		const late = new Date('2024-01-01T01:00:00Z');

		const q = new JobProcessingQueue(agenda);
		q.insert(mkJob('late', 'task', late, 0));
		q.insert(mkJob('early', 'task', early, 0));

		expect(drainOrder(q)[0]).toBe('early');
	});
});
