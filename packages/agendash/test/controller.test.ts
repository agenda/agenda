import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Agenda } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';
import { AgendashController } from '../src/AgendashController.js';
import { mockMongo, IMockMongo } from './helpers/mock-mongodb.js';

describe('AgendashController', () => {
	let mongo: IMockMongo;
	let agenda: Agenda;
	let controller: AgendashController;

	beforeEach(async () => {
		mongo = await mockMongo();
		agenda = new Agenda({ backend: new MongoBackend({ mongo: mongo.db }) });
		await agenda.ready;

		// Define a test job
		agenda.define('test-job', async () => {
			// do nothing
		});

		controller = new AgendashController(agenda);
	});

	afterEach(async () => {
		await agenda.stop();
		await mongo.disconnect();
	});

	describe('getJobs', () => {
		it('should return empty jobs when no jobs exist', async () => {
			const result = await controller.getJobs({});

			expect(result.jobs).toEqual([]);
			expect(result.total).toBe(0);
			expect(result.totalPages).toBe(1);
			expect(result.overview).toHaveLength(1); // Only "All Jobs" entry
			expect(result.overview[0].displayName).toBe('All Jobs');
		});

		it('should return jobs with correct frontend format', async () => {
			await agenda.now('test-job', { foo: 'bar' });

			const result = await controller.getJobs({});

			expect(result.jobs).toHaveLength(1);
			expect(result.jobs[0]).toHaveProperty('job');
			expect(result.jobs[0].job.name).toBe('test-job');
			expect(result.jobs[0].job.data).toEqual({ foo: 'bar' });

			// Check state flags
			expect(typeof result.jobs[0].running).toBe('boolean');
			expect(typeof result.jobs[0].scheduled).toBe('boolean');
			expect(typeof result.jobs[0].queued).toBe('boolean');
			expect(typeof result.jobs[0].completed).toBe('boolean');
			expect(typeof result.jobs[0].failed).toBe('boolean');
			expect(typeof result.jobs[0].repeating).toBe('boolean');
		});

		it('should filter jobs by name', async () => {
			agenda.define('other-job', async () => {});
			await agenda.now('test-job', { id: 1 });
			await agenda.now('other-job', { id: 2 });

			const result = await controller.getJobs({ name: 'test-job' });

			expect(result.jobs).toHaveLength(1);
			expect(result.jobs[0].job.name).toBe('test-job');
		});

		it('should return overview with job statistics', async () => {
			await agenda.now('test-job', { id: 1 });
			await agenda.now('test-job', { id: 2 });

			const result = await controller.getJobs({});

			expect(result.overview).toHaveLength(2); // "All Jobs" + "test-job"
			expect(result.overview[0].displayName).toBe('All Jobs');
			expect(result.overview[0].total).toBe(2);
		});

		it('should paginate results', async () => {
			for (let i = 0; i < 10; i++) {
				await agenda.now('test-job', { id: i });
			}

			const page1 = await controller.getJobs({ limit: 5, skip: 0 });
			const page2 = await controller.getJobs({ limit: 5, skip: 5 });

			expect(page1.jobs).toHaveLength(5);
			expect(page2.jobs).toHaveLength(5);
			expect(page1.totalPages).toBe(2);
		});
	});

	describe('createJob', () => {
		it('should create a job to run now', async () => {
			const result = await controller.createJob({
				jobName: 'test-job',
				jobData: { created: true }
			});

			expect(result.created).toBe(true);

			const jobs = await controller.getJobs({});
			expect(jobs.jobs).toHaveLength(1);
			expect(jobs.jobs[0].job.data).toEqual({ created: true });
		});

		it('should create a scheduled job', async () => {
			const result = await controller.createJob({
				jobName: 'test-job',
				jobSchedule: 'in 1 hour',
				jobData: { scheduled: true }
			});

			expect(result.created).toBe(true);

			const jobs = await controller.getJobs({});
			expect(jobs.jobs).toHaveLength(1);
		});

		it('should create a recurring job', async () => {
			const result = await controller.createJob({
				jobName: 'test-job',
				jobRepeatEvery: '1 hour',
				jobData: { recurring: true }
			});

			expect(result.created).toBe(true);

			const jobs = await controller.getJobs({});
			expect(jobs.jobs).toHaveLength(1);
			expect(jobs.jobs[0].repeating).toBe(true);
		});

		it('should throw error if jobName is missing', async () => {
			await expect(
				controller.createJob({ jobName: '' })
			).rejects.toThrow('jobName is required');
		});
	});

	describe('deleteJobs', () => {
		it('should delete jobs by ID', async () => {
			await agenda.now('test-job', { id: 1 });
			const jobs = await controller.getJobs({});
			const jobId = jobs.jobs[0].job._id;

			const result = await controller.deleteJobs([jobId]);

			expect(result.deleted).toBe(true);
			expect(result.deletedCount).toBe(1);

			const remainingJobs = await controller.getJobs({});
			expect(remainingJobs.jobs).toHaveLength(0);
		});

		it('should return deleted=false for empty array', async () => {
			const result = await controller.deleteJobs([]);

			expect(result.deleted).toBe(false);
			expect(result.deletedCount).toBe(0);
		});

		it('should delete multiple jobs', async () => {
			await agenda.now('test-job', { id: 1 });
			await agenda.now('test-job', { id: 2 });

			const jobs = await controller.getJobs({});
			const jobIds = jobs.jobs.map((j) => j.job._id);

			const result = await controller.deleteJobs(jobIds);

			expect(result.deleted).toBe(true);
			expect(result.deletedCount).toBe(2);
		});
	});

	describe('requeueJobs', () => {
		it('should requeue jobs by creating new instances', async () => {
			await agenda.now('test-job', { id: 1 });
			const jobs = await controller.getJobs({});
			const jobId = jobs.jobs[0].job._id;

			const result = await controller.requeueJobs([jobId]);

			expect(result.requeuedCount).toBe(1);

			// Should now have 2 jobs (original + requeued)
			const allJobs = await controller.getJobs({});
			expect(allJobs.jobs).toHaveLength(2);
		});

		it('should return 0 for empty array', async () => {
			const result = await controller.requeueJobs([]);

			expect(result.requeuedCount).toBe(0);
		});
	});

	describe('pauseJobs', () => {
		it('should pause jobs by ID', async () => {
			await agenda.now('test-job', { id: 1 });
			const jobs = await controller.getJobs({});
			const jobId = jobs.jobs[0].job._id;

			const result = await controller.pauseJobs([jobId]);

			expect(result.pausedCount).toBe(1);

			// Verify job is now paused
			const updatedJobs = await controller.getJobs({});
			expect(updatedJobs.jobs[0].paused).toBe(true);
			expect(updatedJobs.jobs[0].job.disabled).toBe(true);
		});

		it('should return 0 for empty array', async () => {
			const result = await controller.pauseJobs([]);

			expect(result.pausedCount).toBe(0);
		});

		it('should pause multiple jobs', async () => {
			await agenda.now('test-job', { id: 1 });
			await agenda.now('test-job', { id: 2 });

			const jobs = await controller.getJobs({});
			const jobIds = jobs.jobs.map((j) => j.job._id);

			const result = await controller.pauseJobs(jobIds);

			expect(result.pausedCount).toBe(2);

			// Verify all jobs are paused
			const updatedJobs = await controller.getJobs({});
			expect(updatedJobs.jobs.every((j) => j.paused)).toBe(true);
		});
	});

	describe('resumeJobs', () => {
		it('should resume paused jobs by ID', async () => {
			await agenda.now('test-job', { id: 1 });
			const jobs = await controller.getJobs({});
			const jobId = jobs.jobs[0].job._id;

			// First pause the job
			await controller.pauseJobs([jobId]);

			// Verify it's paused
			const pausedJobs = await controller.getJobs({});
			expect(pausedJobs.jobs[0].paused).toBe(true);

			// Resume the job
			const result = await controller.resumeJobs([jobId]);

			expect(result.resumedCount).toBe(1);

			// Verify job is resumed
			const resumedJobs = await controller.getJobs({});
			expect(resumedJobs.jobs[0].paused).toBe(false);
			expect(resumedJobs.jobs[0].job.disabled).toBeFalsy();
		});

		it('should return 0 for empty array', async () => {
			const result = await controller.resumeJobs([]);

			expect(result.resumedCount).toBe(0);
		});

		it('should resume multiple jobs', async () => {
			await agenda.now('test-job', { id: 1 });
			await agenda.now('test-job', { id: 2 });

			const jobs = await controller.getJobs({});
			const jobIds = jobs.jobs.map((j) => j.job._id);

			// Pause all jobs
			await controller.pauseJobs(jobIds);

			// Resume all jobs
			const result = await controller.resumeJobs(jobIds);

			expect(result.resumedCount).toBe(2);

			// Verify all jobs are resumed
			const resumedJobs = await controller.getJobs({});
			expect(resumedJobs.jobs.every((j) => !j.paused)).toBe(true);
		});
	});
});
