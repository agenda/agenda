import { describe, it, expect } from 'vitest';
import { Agenda, toJobId } from '../src/index.js';
import type { AgendaBackend, JobRepository, JobParameters } from '../src/index.js';
import { JobsController, Every, registerJobs } from '../src/decorators/index.js';

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

describe('registerJobs called after agenda is ready', () => {
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
