/**
 * Regression tests for high-risk bugs found and fixed on the `bug-testing` branch.
 *
 * Each describe block corresponds to one bug documented in BUGS.md at the repo
 * root. The assertions encode the *correct* behaviour, so they fail against the
 * pre-fix source and pass against the fixed source.
 */
import { describe, it, expect } from 'vitest';
import { JobProcessingQueue } from '../src/JobProcessingQueue.js';
import { Agenda, toJobId } from '../src/index.js';
import type { AgendaBackend, JobRepository, JobParameters } from '../src/index.js';
import { JobsController, Every, registerJobs } from '../src/decorators/index.js';
import { exponential } from '../src/utils/backoff.js';

const savedJobNames: string[] = [];

class RecordingRepo implements JobRepository {
	async connect() {}
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
	async saveJob<DATA = unknown>(job: JobParameters<DATA>): Promise<JobParameters<DATA>> {
		savedJobNames.push(job.name);
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
	async disableJobs() {
		return 0;
	}
	async enableJobs() {
		return 0;
	}
	async purgeAllJobs() {
		return 0;
	}
}

class RecordingBackend implements AgendaBackend {
	readonly name = 'RecordingBackend';
	readonly repository = new RecordingRepo();
	async connect() {}
	async disconnect() {}
}

const tick = () => new Promise(r => setTimeout(r, 20));

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

describe('Bug #1: JobProcessingQueue insertion ordering', () => {
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

describe('Bug #2: registerJobs called after agenda is ready', () => {
	it('still schedules @Every jobs when registered after the ready event fired', async () => {
		savedJobNames.length = 0;

		@JobsController()
		class MyJobs {
			@Every('1 hour', { name: 'recurringTask' })
			async recurringTask() {}
		}

		const agenda = new Agenda({ backend: new RecordingBackend() });

		// A real app commonly awaits readiness before wiring up controllers.
		await agenda.ready;
		await tick();

		registerJobs(agenda, [new MyJobs()]);
		await agenda.start();
		await tick();

		expect(savedJobNames).toContain('recurringTask');

		await agenda.stop().catch(() => {});
	});
});

describe('Bug #3: backoff failCount reset for recurring jobs', () => {
	it('starts a fresh retry sequence after a successful run between failures', async () => {
		const agenda = new Agenda({ backend: new RecordingBackend() });
		await agenda.ready;

		let shouldFail = true;
		const retries: number[] = [];

		agenda.define(
			'recurring',
			async () => {
				if (shouldFail) throw new Error('boom');
			},
			{ backoff: exponential({ delay: 5, maxRetries: 2 }) }
		);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- event payload
		agenda.on('retry', (_job: any, details: any) => retries.push(details.attempt));

		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- direct job control
		const job: any = agenda.create('recurring', {});
		job.attrs._id = toJobId('recurring-id');
		job.attrs.type = 'single';
		job.attrs.repeatInterval = '1 day';

		// Exhaust the retry budget.
		await job.run();
		await job.run();
		await job.run();

		// Recover with a successful run.
		shouldFail = false;
		await job.run();
		expect(job.attrs.failCount).toBe(0);

		// A subsequent failure should be treated as a brand new incident.
		shouldFail = true;
		const retriesBefore = retries.length;
		await job.run();

		expect(retries.length).toBeGreaterThan(retriesBefore);
	});
});
