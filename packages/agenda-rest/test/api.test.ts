import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { Agenda } from 'agenda';
import { MongoBackend } from '@agenda.js/mongo-backend';
import { createServer } from '../src/server.js';
import { mockMongo, IMockMongo } from './helpers/mock-mongodb.js';
import type Koa from 'koa';

describe('Agenda REST API', () => {
	let mongo: IMockMongo;
	let agenda: Agenda;
	let app: Koa;

	beforeEach(async () => {
		mongo = await mockMongo();
		agenda = new Agenda({ backend: new MongoBackend({ mongo: mongo.db }) });
		await agenda.ready;
		await agenda.start();

		app = createServer({ agenda });
	});

	afterEach(async () => {
		await agenda.stop();
		await mongo.disconnect();
	});

	describe('GET /api/health', () => {
		it('should return health status', async () => {
			const res = await request(app.callback()).get('/api/health').expect(200);

			expect(res.body.status).toBe('ok');
		});
	});

	describe('Job Definitions', () => {
		describe('POST /api/job', () => {
			it('should create a job definition', async () => {
				const res = await request(app.callback())
					.post('/api/job')
					.send({ name: 'test-job', url: 'http://example.com/webhook' })
					.expect(200);

				expect(res.body.success).toBe(true);
				expect(res.body.message).toContain('test-job');
			});

			it('should return 400 if name is missing', async () => {
				const res = await request(app.callback())
					.post('/api/job')
					.send({ url: 'http://example.com' })
					.expect(400);

				expect(res.body.error).toContain('name');
			});

			it('should return 409 if job already exists', async () => {
				await request(app.callback())
					.post('/api/job')
					.send({ name: 'duplicate-job' })
					.expect(200);

				const res = await request(app.callback())
					.post('/api/job')
					.send({ name: 'duplicate-job' })
					.expect(409);

				expect(res.body.error).toContain('already exists');
			});
		});

		describe('GET /api/job', () => {
			it('should list job definitions', async () => {
				await request(app.callback())
					.post('/api/job')
					.send({ name: 'job-1' });
				await request(app.callback())
					.post('/api/job')
					.send({ name: 'job-2' });

				const res = await request(app.callback()).get('/api/job').expect(200);

				expect(res.body.jobs).toHaveLength(2);
			});
		});

		describe('PUT /api/job/:jobName', () => {
			it('should update a job definition', async () => {
				await request(app.callback())
					.post('/api/job')
					.send({ name: 'update-test', url: 'http://old.com' });

				const res = await request(app.callback())
					.put('/api/job/update-test')
					.send({ url: 'http://new.com' })
					.expect(200);

				expect(res.body.success).toBe(true);
			});

			it('should return 404 if job does not exist', async () => {
				const res = await request(app.callback())
					.put('/api/job/nonexistent')
					.send({ url: 'http://example.com' })
					.expect(404);

				expect(res.body.error).toContain('not found');
			});
		});

		describe('DELETE /api/job/:jobName', () => {
			it('should delete a job definition', async () => {
				await request(app.callback())
					.post('/api/job')
					.send({ name: 'delete-test' });

				const res = await request(app.callback())
					.delete('/api/job/delete-test')
					.expect(200);

				expect(res.body.success).toBe(true);

				// Verify it's gone
				const list = await request(app.callback()).get('/api/job');
				expect(list.body.jobs).toHaveLength(0);
			});
		});
	});

	describe('Job Scheduling', () => {
		describe('POST /api/job/now', () => {
			it('should schedule a job to run now', async () => {
				const res = await request(app.callback())
					.post('/api/job/now')
					.send({ name: 'run-now-job', data: { foo: 'bar' } })
					.expect(200);

				expect(res.body.success).toBe(true);
				expect(res.body.jobId).toBeDefined();
			});

			it('should return 400 if name is missing', async () => {
				const res = await request(app.callback())
					.post('/api/job/now')
					.send({ data: { foo: 'bar' } })
					.expect(400);

				expect(res.body.error).toContain('name');
			});
		});

		describe('POST /api/job/once', () => {
			it('should schedule a one-time job', async () => {
				const res = await request(app.callback())
					.post('/api/job/once')
					.send({ name: 'once-job', when: 'in 1 hour', data: { test: true } })
					.expect(200);

				expect(res.body.success).toBe(true);
				expect(res.body.jobId).toBeDefined();
			});

			it('should return 400 if when is missing', async () => {
				const res = await request(app.callback())
					.post('/api/job/once')
					.send({ name: 'once-job' })
					.expect(400);

				expect(res.body.error).toContain('when');
			});
		});

		describe('POST /api/job/every', () => {
			it('should schedule a recurring job', async () => {
				const res = await request(app.callback())
					.post('/api/job/every')
					.send({ name: 'recurring-job', interval: '5 minutes' })
					.expect(200);

				expect(res.body.success).toBe(true);
				expect(res.body.jobId).toBeDefined();
			});

			it('should return 400 if interval is missing', async () => {
				const res = await request(app.callback())
					.post('/api/job/every')
					.send({ name: 'recurring-job' })
					.expect(400);

				expect(res.body.error).toContain('interval');
			});
		});

		describe('POST /api/job/cancel', () => {
			it('should cancel jobs by name', async () => {
				// Schedule some jobs first
				await request(app.callback())
					.post('/api/job/now')
					.send({ name: 'cancel-test' });
				await request(app.callback())
					.post('/api/job/now')
					.send({ name: 'cancel-test' });

				const res = await request(app.callback())
					.post('/api/job/cancel')
					.send({ name: 'cancel-test' })
					.expect(200);

				expect(res.body.success).toBe(true);
				expect(res.body.cancelledCount).toBe(2);
			});

			it('should return 400 if no filter provided', async () => {
				const res = await request(app.callback())
					.post('/api/job/cancel')
					.send({})
					.expect(400);

				expect(res.body.error).toContain('name or data');
			});
		});
	});

	describe('Authentication', () => {
		let secureApp: Koa;

		beforeEach(() => {
			secureApp = createServer({ agenda, apiKey: 'secret-key' });
		});

		it('should reject requests without API key', async () => {
			const res = await request(secureApp.callback())
				.get('/api/job')
				.expect(403);

			expect(res.body.error).toContain('Forbidden');
		});

		it('should reject requests with wrong API key', async () => {
			const res = await request(secureApp.callback())
				.get('/api/job')
				.set('X-API-Key', 'wrong-key')
				.expect(403);

			expect(res.body.error).toContain('Forbidden');
		});

		it('should allow requests with correct API key', async () => {
			const res = await request(secureApp.callback())
				.get('/api/job')
				.set('X-API-Key', 'secret-key')
				.expect(200);

			expect(res.body.jobs).toBeDefined();
		});
	});
});
