import { describe, it, expect } from 'vitest';
import { Agenda, toJobId } from '../src/index.js';
import type { AgendaBackend, JobRepository, JobParameters } from '../src/index.js';
import { exponential } from '../src/utils/backoff.js';

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

describe('backoff failCount reset for recurring jobs', () => {
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
