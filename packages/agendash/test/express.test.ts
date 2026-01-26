import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { Agenda } from 'agenda';
import { MongoBackend } from '@agenda.js/mongo-backend';
import { createExpressMiddleware } from '../src/middlewares/express.js';
import { mockMongo, IMockMongo } from './helpers/mock-mongodb.js';

describe('Express Middleware', () => {
	let mongo: IMockMongo;
	let agenda: Agenda;
	let app: express.Application;

	beforeEach(async () => {
		mongo = await mockMongo();
		agenda = new Agenda({ backend: new MongoBackend({ mongo: mongo.db }) });
		await agenda.ready;

		// Define a test job
		agenda.define('test-job', async () => {
			// do nothing
		});

		app = express();
		app.use('/dash', createExpressMiddleware(agenda));
	});

	afterEach(async () => {
		await agenda.stop();
		await mongo.disconnect();
	});

	describe('GET /api', () => {
		it('should return jobs and overview', async () => {
			const res = await request(app).get('/dash/api').expect(200);

			expect(res.body).toHaveProperty('jobs');
			expect(res.body).toHaveProperty('overview');
			expect(res.body).toHaveProperty('total');
			expect(res.body).toHaveProperty('totalPages');
			expect(Array.isArray(res.body.jobs)).toBe(true);
			expect(Array.isArray(res.body.overview)).toBe(true);
		});

		it('should filter by job name', async () => {
			agenda.define('other-job', async () => {});
			await agenda.now('test-job', { id: 1 });
			await agenda.now('other-job', { id: 2 });

			const res = await request(app)
				.get('/dash/api')
				.query({ job: 'test-job' })
				.expect(200);

			expect(res.body.jobs).toHaveLength(1);
			expect(res.body.jobs[0].job.name).toBe('test-job');
		});

		it('should support pagination', async () => {
			for (let i = 0; i < 10; i++) {
				await agenda.now('test-job', { id: i });
			}

			const res = await request(app)
				.get('/dash/api')
				.query({ limit: '5', skip: '0' })
				.expect(200);

			expect(res.body.jobs).toHaveLength(5);
			expect(res.body.totalPages).toBe(2);
		});

		it('should include CSP header', async () => {
			const res = await request(app).get('/dash/api').expect(200);

			expect(res.headers['content-security-policy']).toBeDefined();
		});
	});

	describe('POST /api/jobs/create', () => {
		it('should create a job', async () => {
			const res = await request(app)
				.post('/dash/api/jobs/create')
				.send({ jobName: 'test-job', jobData: { test: true } })
				.expect(200);

			expect(res.body.created).toBe(true);

			// Verify job was created
			const jobs = await request(app).get('/dash/api');
			expect(jobs.body.jobs).toHaveLength(1);
		});

		it('should return 400 for missing jobName', async () => {
			const res = await request(app)
				.post('/dash/api/jobs/create')
				.send({ jobData: { test: true } })
				.expect(400);

			expect(res.body.error).toBeDefined();
		});
	});

	describe('POST /api/jobs/delete', () => {
		it('should delete jobs', async () => {
			await agenda.now('test-job', { id: 1 });
			const jobsRes = await request(app).get('/dash/api');
			const jobId = jobsRes.body.jobs[0].job._id;

			const res = await request(app)
				.post('/dash/api/jobs/delete')
				.send({ jobIds: [jobId] })
				.expect(200);

			expect(res.body.deleted).toBe(true);

			// Verify job was deleted
			const remainingJobs = await request(app).get('/dash/api');
			expect(remainingJobs.body.jobs).toHaveLength(0);
		});
	});

	describe('POST /api/jobs/requeue', () => {
		it('should requeue jobs', async () => {
			await agenda.now('test-job', { id: 1 });
			const jobsRes = await request(app).get('/dash/api');
			const jobId = jobsRes.body.jobs[0].job._id;

			const res = await request(app)
				.post('/dash/api/jobs/requeue')
				.send({ jobIds: [jobId] })
				.expect(200);

			expect(res.body.requeuedCount).toBe(1);

			// Verify new job was created
			const allJobs = await request(app).get('/dash/api');
			expect(allJobs.body.jobs).toHaveLength(2);
		});
	});

	describe('Static files', () => {
		it('should serve index.html', async () => {
			const res = await request(app).get('/dash/').expect(200);

			expect(res.text).toContain('Agendash');
			expect(res.headers['content-type']).toContain('text/html');
		});
	});
});
