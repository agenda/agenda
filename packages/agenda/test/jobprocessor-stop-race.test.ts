import { describe, it, expect } from 'vitest';
import { Agenda } from '../src/index.js';
import type { AgendaBackend } from '../src/index.js';
import type { JobRepository, RemoveJobsOptions } from '../src/types/JobRepository.js';
import type { JobParameters } from '../src/types/JobParameters.js';

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Minimal in-memory repository with the backends' locking semantics. getNextJobToRun
 * can be paused (`hold()`), to simulate a lock query that is still in flight at the
 * database when agenda.stop() runs, as happens with Postgres under CI load.
 */
class InMemoryRepository implements JobRepository {
	private store = new Map<string, JobParameters>();

	private nextId = 1;

	async connect(): Promise<void> {}

	async queryJobs(options?: { id?: unknown; name?: string }) {
		let jobs = [...this.store.values()];
		if (options?.id) {
			jobs = jobs.filter(j => j._id?.toString() === options.id?.toString());
		}
		if (options?.name) {
			jobs = jobs.filter(j => j.name === options.name);
		}
		return { jobs: jobs.map(j => ({ ...j })), total: jobs.length } as never;
	}

	async getJobsOverview() {
		return [];
	}

	async getDistinctJobNames() {
		return [...new Set([...this.store.values()].map(j => j.name))];
	}

	async getJobById(id: string) {
		const job = this.store.get(id);
		return job ? { ...job } : null;
	}

	async getQueueSize() {
		const now = new Date();
		return [...this.store.values()].filter(j => j.nextRunAt && j.nextRunAt <= now).length;
	}

	async removeJobs(options: RemoveJobsOptions) {
		let removed = 0;
		for (const [key, job] of [...this.store.entries()]) {
			const matchesId = options.id !== undefined && job._id?.toString() === options.id.toString();
			const matchesName = options.name !== undefined && job.name === options.name;
			if (matchesId || matchesName) {
				this.store.delete(key);
				removed += 1;
			}
		}
		return removed;
	}

	async saveJob<DATA = unknown>(job: JobParameters<DATA>): Promise<JobParameters<DATA>> {
		const copy = { ...job } as JobParameters<DATA>;
		if (!copy._id) {
			copy._id = String(this.nextId++) as never;
		}
		this.store.set(copy._id.toString(), copy as never);
		return { ...copy };
	}

	async saveJobState(job: JobParameters) {
		if (!job._id) {
			return;
		}
		const existing = this.store.get(job._id.toString());
		if (!existing) {
			return;
		}
		existing.lockedAt = job.lockedAt;
		existing.lastRunAt = job.lastRunAt;
		existing.lastFinishedAt = job.lastFinishedAt;
		existing.nextRunAt = job.nextRunAt;
		existing.progress = job.progress;
		existing.failCount = job.failCount;
	}

	async lockJob(job: JobParameters) {
		if (!job._id) {
			return undefined;
		}
		const existing = this.store.get(job._id.toString());
		if (!existing || existing.lockedAt != null || existing.disabled) {
			return undefined;
		}
		existing.lockedAt = new Date();
		return { ...existing };
	}

	async unlockJob(job: JobParameters) {
		if (!job._id) {
			return;
		}
		const existing = this.store.get(job._id.toString());
		if (existing && existing.nextRunAt != null) {
			existing.lockedAt = undefined;
		}
	}

	async unlockJobs(ids: unknown[]) {
		for (const id of ids) {
			const existing = this.store.get(String(id));
			if (existing) {
				existing.lockedAt = undefined;
			}
		}
	}

	private gate?: Promise<void>;

	private releaseGate?: () => void;

	/** resolves once a getNextJobToRun call is waiting at the gate */
	queryWaiting?: Promise<void>;

	private signalWaiting?: () => void;

	hold(): void {
		this.gate = new Promise(resolve => {
			this.releaseGate = resolve;
		});
		this.queryWaiting = new Promise(resolve => {
			this.signalWaiting = resolve;
		});
	}

	release(): void {
		this.gate = undefined;
		this.releaseGate?.();
	}

	async getNextJobToRun(name: string, nextScanAt: Date, lockDeadline: Date, now?: Date) {
		if (this.gate) {
			this.signalWaiting?.();
			await this.gate;
		}
		const lockedAt = now ?? new Date();
		const candidates = [...this.store.values()].filter(j => {
			if (j.name !== name || j.disabled) {
				return false;
			}
			const freeAndDue = j.lockedAt == null && j.nextRunAt != null && j.nextRunAt <= nextScanAt;
			const lockExpired = j.lockedAt != null && j.lockedAt <= lockDeadline;
			return freeAndDue || lockExpired;
		});
		if (!candidates.length) {
			return undefined;
		}
		candidates.sort((a, b) => {
			const an = a.nextRunAt ? a.nextRunAt.getTime() : Infinity;
			const bn = b.nextRunAt ? b.nextRunAt.getTime() : Infinity;
			return an !== bn ? an - bn : (b.priority || 0) - (a.priority || 0);
		});
		const chosen = this.store.get(candidates[0]._id!.toString())!;
		chosen.lockedAt = lockedAt;
		return { ...chosen };
	}

	async disableJobs() {
		return 0;
	}

	async enableJobs() {
		return 0;
	}

	async purgeAllJobs() {
		const size = this.store.size;
		this.store.clear();
		return size;
	}

	// test helper
	lockedCount(name: string): number {
		return [...this.store.values()].filter(j => j.name === name && j.lockedAt != null).length;
	}
}

class InMemoryBackend implements AgendaBackend {
	readonly name = 'InMemory';

	readonly repository = new InMemoryRepository();

	readonly ownsConnection = false;

	async connect(): Promise<void> {}

	async disconnect(): Promise<void> {}
}

describe('JobProcessor stop() while a queue fill is in flight', () => {
	it('does not leave a queued job locked when a lock query completes after stop()', async () => {
		const backend = new InMemoryBackend();
		const repo = backend.repository;
		const agenda = new Agenda({ backend, processEvery: 50 });
		agenda.on('error', () => {});

		let releaseRunning: () => void = () => {};
		agenda.define(
			'race',
			() =>
				new Promise<void>(resolve => {
					releaseRunning = resolve;
				}),
			{ concurrency: 1 }
		);

		await agenda.start();
		await Promise.all([agenda.now('race'), agenda.now('race')]);

		// one running, one locked + queued (concurrency 1)
		const deadline = Date.now() + 5000;
		while (Date.now() < deadline) {
			const stats = await agenda.getRunningStats();
			if ((stats.lockedJobs as number) >= 2 && stats.runningJobs === 1) break;
			await delay(10);
		}
		expect(repo.lockedCount('race')).toBe(2);

		// next periodic scan's lock query is "in flight" at the database
		repo.hold();
		await repo.queryWaiting;

		const stopped = agenda.stop();
		// let stop() unlock the queued job first, then let the in-flight query finish
		await delay(20);
		repo.release();
		await stopped;
		await delay(20);

		// only the running job may keep its lock
		expect(repo.lockedCount('race')).toBe(1);
		releaseRunning();
	}, 20000);
});
