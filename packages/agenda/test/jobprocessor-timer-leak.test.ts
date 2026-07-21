/**
 * Regression test for #1786: JobProcessor armed a setTimeout for jobs whose
 * nextRunAt is in the near future without tracking it, so stop()/drain() never
 * cleared it. The timer kept the event loop alive (and could re-arm itself for
 * recurring jobs), preventing the process from exiting after agenda.stop().
 */
import { describe, it, expect } from 'vitest';
import { Agenda, toJobId } from '../src/index.js';
import type { AgendaBackend, JobRepository, JobParameters } from '../src/index.js';

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Minimal repository whose getNextJobToRun hands out a single job with a
 * nextRunAt in the near future (within the processEvery window), which is
 * exactly the shape that makes the processor arm a near-future timer.
 */
class FutureJobRepo implements JobRepository {
	public handedOut = false;

	public runAt: Date = new Date();

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

	async getNextJobToRun(): Promise<JobParameters | undefined> {
		if (this.handedOut) {
			return undefined;
		}
		this.handedOut = true;
		return {
			_id: toJobId('future-job'),
			name: 'timer-leak-test',
			priority: 0,
			type: 'normal',
			nextRunAt: this.runAt,
			lockedAt: new Date(),
			data: {}
		};
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

class FutureJobBackend implements AgendaBackend {
	readonly name = 'FutureJobBackend';

	readonly repository = new FutureJobRepo();

	async connect() {}

	async disconnect() {}
}

describe('JobProcessor near-future timer cleanup (#1786)', () => {
	it('clears armed near-future timers on stop() so nothing runs or lingers afterwards', async () => {
		const backend = new FutureJobBackend();
		// The job is due ~1s from now, well within the 5s processEvery window,
		// so the processor takes the arm-a-timer branch instead of running it.
		backend.repository.runAt = new Date(Date.now() + 1000);

		const agenda = new Agenda({ backend, processEvery: 5000 });
		agenda.on('error', () => {});

		let ran = 0;
		agenda.define('timer-leak-test', async () => {
			ran += 1;
		});

		await agenda.start();
		// Give the initial scan a moment to pick up the job and arm the timer
		await delay(200);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- white-box access to the processor internals
		const processor = (agenda as any).jobProcessor;
		expect(processor).toBeDefined();
		expect(processor.nextRunTimers.size).toBe(1);

		await agenda.stop();
		expect(processor.nextRunTimers.size).toBe(0);

		// Wait past the job's due time: the cleared timer must not fire the job
		await delay(1200);
		expect(ran).toBe(0);
	});
});
