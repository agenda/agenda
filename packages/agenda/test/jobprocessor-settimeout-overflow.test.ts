/**
 * Regression test for setTimeout 32-bit signed-integer overflow.
 *
 * Node.js clamps delays > 2^31 - 1 to 1 ms and emits TimeoutOverflowWarning.
 * When processEvery is large enough (e.g. a human-interval such as "30 days"),
 * a near-future job can have a runIn that exceeds 2^31 - 1 and reach the
 * setTimeout branch in JobProcessor. JobProcessor must clamp that delay to
 * 2^31 - 1, not 2^31, otherwise the timer fires immediately and the job is
 * reprocessed in a tight loop.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Agenda, toJobId } from '../src/index.js';
import type { AgendaBackend, JobRepository, JobParameters } from '../src/index.js';

const MAX_SIGNED_32BIT = 2 ** 31 - 1;
const OVER_MAX_SIGNED_32BIT = 2 ** 31 + 500;

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
			_id: toJobId('overflow-test'),
			name: 'overflow-test',
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

describe('JobProcessor setTimeout overflow clamp', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('clamps near-future timers to the maximum signed 32-bit delay', async () => {
		const backend = new FutureJobBackend();
		// processEvery is larger than the job's runIn, so the processor takes the
		// arm-a-timer branch instead of freeing the job for the next scan.
		backend.repository.runAt = new Date(Date.now() + OVER_MAX_SIGNED_32BIT);

		const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

		const agenda = new Agenda({
			backend,
			// processEvery larger than runIn; human-interval "30 days" is realistic.
			processEvery: OVER_MAX_SIGNED_32BIT + 1000
		});
		agenda.on('error', () => {});

		agenda.define('overflow-test', async () => {});

		await agenda.start();

		// Let the initial async job queue filling settle.
		await vi.advanceTimersByTimeAsync(1);

		const timerDelays = setTimeoutSpy.mock.calls
			.map(args => (typeof args[1] === 'number' ? args[1] : -1))
			.filter(delay => delay > 1000);

		expect(timerDelays).toContain(MAX_SIGNED_32BIT);
		expect(timerDelays).not.toContain(2 ** 31);

		await agenda.stop();
	});
});
