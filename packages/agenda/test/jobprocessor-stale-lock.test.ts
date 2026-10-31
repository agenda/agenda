import { describe, it, expect } from 'vitest';
import { Agenda } from '../src/index.js';
import type { AgendaBackend } from '../src/index.js';
import type { JobRepository, RemoveJobsOptions } from '../src/types/JobRepository.js';
import type { JobParameters } from '../src/types/JobParameters.js';

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Minimal in-memory repository that mirrors the locking semantics the backends
 * implement: getNextJobToRun returns a job that is either free and due, or whose
 * lock has expired (regardless of nextRunAt). This is enough to exercise the
 * processor's lock handling without a database.
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

	async getNextJobToRun(name: string, nextScanAt: Date, lockDeadline: Date, now?: Date) {
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
	seed(job: JobParameters): void {
		this.store.set(job._id!.toString(), job);
	}
}

class InMemoryBackend implements AgendaBackend {
	readonly name = 'InMemory';

	readonly repository = new InMemoryRepository();

	readonly ownsConnection = false;

	async connect(): Promise<void> {}

	async disconnect(): Promise<void> {}
}

describe('JobProcessor stale lock on a future-dated job', () => {
	it('runs a job that was locked while its nextRunAt is still in the future', async () => {
		const backend = new InMemoryBackend();
		const repo = backend.repository;
		const agenda = new Agenda({ backend, processEvery: 100, maxConcurrency: 10, defaultConcurrency: 10 });
		agenda.on('error', () => {});

		let ranAt = 0;
		agenda.define(
			'recurring',
			async () => {
				ranAt = Date.now();
			},
			{ lockLifetime: 10000 }
		);
		await agenda.start();

		// A recurring job left locked by a crashed worker: nextRunAt is in the
		// future, but lockedAt is old enough to be considered expired.
		const start = Date.now();
		const dueIn = 800;
		repo.seed({
			_id: '900',
			name: 'recurring',
			priority: 0,
			type: 'normal',
			nextRunAt: new Date(start + dueIn),
			lockedAt: new Date(start - 100000)
		} as never);

		await delay(3000);
		await agenda.stop();

		expect(ranAt).toBeGreaterThan(0);
		expect(ranAt - (start + dueIn)).toBeLessThan(1000);
	}, 20000);
});
