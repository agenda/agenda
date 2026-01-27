/**
 * Tests for Agenda decorators
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
	JobsController,
	Define,
	Every,
	registerJobs,
	getControllerMetadata,
	isJobsController,
	JobsRegistrationError
} from '../src/decorators/index.js';
import { Agenda, toJobId } from '../src/index.js';
import type { Job } from '../src/Job.js';
import type { AgendaBackend, JobRepository, JobParameters } from '../src/index.js';

/**
 * Minimal mock repository for unit tests
 */
class MockJobRepository implements JobRepository {
	async connect(): Promise<void> {}
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
}

/**
 * Minimal mock backend for unit tests
 */
class MockBackend implements AgendaBackend {
	readonly name = 'MockBackend';
	readonly repository = new MockJobRepository();
	async connect(): Promise<void> {}
	async disconnect(): Promise<void> {}
}

describe('Decorators', () => {
	describe('@JobsController', () => {
		it('should mark a class as a jobs controller', () => {
			@JobsController()
			class TestJobs {}

			expect(isJobsController(TestJobs)).toBe(true);
		});

		it('should store namespace in metadata', () => {
			@JobsController({ namespace: 'email' })
			class EmailJobs {}

			const metadata = getControllerMetadata(EmailJobs);
			expect(metadata?.namespace).toBe('email');
		});

		it('should work without namespace', () => {
			@JobsController()
			class SimpleJobs {}

			const metadata = getControllerMetadata(SimpleJobs);
			expect(metadata?.namespace).toBeUndefined();
		});
	});

	describe('@Define', () => {
		it('should register a method as a job definition', () => {
			@JobsController()
			class TestJobs {
				@Define()
				async myJob(_job: Job) {
					// handler
				}
			}

			const metadata = getControllerMetadata(TestJobs);
			expect(metadata?.jobs.has('myJob')).toBe(true);
			expect(metadata?.jobs.get('myJob')?.type).toBe('define');
		});

		it('should store custom name in options', () => {
			@JobsController()
			class TestJobs {
				@Define({ name: 'customName' })
				async myJob(_job: Job) {}
			}

			const metadata = getControllerMetadata(TestJobs);
			const jobMeta = metadata?.jobs.get('myJob');
			expect(jobMeta?.options.name).toBe('customName');
		});

		it('should store concurrency and priority options', () => {
			@JobsController()
			class TestJobs {
				@Define({ concurrency: 10, priority: 'high' })
				async myJob(_job: Job) {}
			}

			const metadata = getControllerMetadata(TestJobs);
			const jobMeta = metadata?.jobs.get('myJob');
			expect(jobMeta?.options.concurrency).toBe(10);
			expect(jobMeta?.options.priority).toBe('high');
		});
	});

	describe('@Every', () => {
		it('should register a method as a recurring job', () => {
			@JobsController()
			class TestJobs {
				@Every('5 minutes')
				async recurringJob(_job: Job) {}
			}

			const metadata = getControllerMetadata(TestJobs);
			const jobMeta = metadata?.jobs.get('recurringJob');
			expect(jobMeta?.type).toBe('every');
			expect(jobMeta?.interval).toBe('5 minutes');
		});

		it('should support cron expressions', () => {
			@JobsController()
			class TestJobs {
				@Every('0 9 * * MON')
				async weeklyJob(_job: Job) {}
			}

			const metadata = getControllerMetadata(TestJobs);
			const jobMeta = metadata?.jobs.get('weeklyJob');
			expect(jobMeta?.interval).toBe('0 9 * * MON');
		});

		it('should store timezone option', () => {
			@JobsController()
			class TestJobs {
				@Every('0 9 * * *', { timezone: 'America/New_York' })
				async dailyJob(_job: Job) {}
			}

			const metadata = getControllerMetadata(TestJobs);
			const jobMeta = metadata?.jobs.get('dailyJob');
			expect((jobMeta?.options as { timezone?: string }).timezone).toBe('America/New_York');
		});
	});

	describe('registerJobs', () => {
		let agenda: Agenda;

		beforeEach(async () => {
			agenda = new Agenda({ backend: new MockBackend() });
			await agenda.ready;
		});

		it('should throw if class is not decorated with @JobsController', () => {
			class UndecoratedClass {
				async someMethod(_job: Job) {}
			}

			expect(() => {
				registerJobs(agenda, [new UndecoratedClass()]);
			}).toThrow(JobsRegistrationError);
		});

		it('should register @Define jobs with Agenda', () => {
			@JobsController()
			class TestJobs {
				@Define()
				async testJob(_job: Job) {}
			}

			registerJobs(agenda, [new TestJobs()]);

			expect(agenda.definitions['testJob']).toBeDefined();
		});

		it('should prefix job names with namespace', () => {
			@JobsController({ namespace: 'email' })
			class EmailJobs {
				@Define()
				async sendWelcome(_job: Job) {}
			}

			registerJobs(agenda, [new EmailJobs()]);

			expect(agenda.definitions['email.sendWelcome']).toBeDefined();
		});

		it('should use custom job name if specified', () => {
			@JobsController({ namespace: 'email' })
			class EmailJobs {
				@Define({ name: 'welcome' })
				async sendWelcomeEmail(_job: Job) {}
			}

			registerJobs(agenda, [new EmailJobs()]);

			expect(agenda.definitions['email.welcome']).toBeDefined();
		});

		it('should pass options to job definition', () => {
			@JobsController()
			class TestJobs {
				@Define({ concurrency: 15, lockLifetime: 60000 })
				async myJob(_job: Job) {}
			}

			registerJobs(agenda, [new TestJobs()]);

			expect(agenda.definitions['myJob'].concurrency).toBe(15);
			expect(agenda.definitions['myJob'].lockLifetime).toBe(60000);
		});

		it('should bind methods to instance context', async () => {
			const calls: string[] = [];

			@JobsController()
			class TestJobs {
				private serviceName = 'TestService';

				@Define()
				async myJob(_job: Job) {
					calls.push(this.serviceName);
				}
			}

			const instance = new TestJobs();
			registerJobs(agenda, [instance]);

			// Get the registered handler and call it
			const definition = agenda.definitions['myJob'];
			const mockJob = { attrs: { data: {} } } as Job;
			await (definition.fn as (job: Job) => Promise<void>)(mockJob);

			expect(calls).toEqual(['TestService']);
		});

		it('should register multiple job controllers', () => {
			@JobsController({ namespace: 'email' })
			class EmailJobs {
				@Define()
				async send(_job: Job) {}
			}

			@JobsController({ namespace: 'reports' })
			class ReportJobs {
				@Define()
				async generate(_job: Job) {}
			}

			registerJobs(agenda, [new EmailJobs(), new ReportJobs()]);

			expect(agenda.definitions['email.send']).toBeDefined();
			expect(agenda.definitions['reports.generate']).toBeDefined();
		});

		it('should register multiple jobs from same controller', () => {
			@JobsController()
			class MultiJobs {
				@Define()
				async job1(_job: Job) {}

				@Define()
				async job2(_job: Job) {}

				@Every('1 hour')
				async job3(_job: Job) {}
			}

			registerJobs(agenda, [new MultiJobs()]);

			expect(agenda.definitions['job1']).toBeDefined();
			expect(agenda.definitions['job2']).toBeDefined();
			expect(agenda.definitions['job3']).toBeDefined();
		});

		it('should work with jobs that have dependencies', async () => {
			// Simulating dependency injection pattern
			const sentEmails: string[] = [];

			class EmailService {
				send(to: string) {
					sentEmails.push(to);
				}
			}

			@JobsController({ namespace: 'notifications' })
			class NotificationJobs {
				constructor(private emailService: EmailService) {}

				@Define()
				async sendEmail(job: Job<{ to: string }>) {
					this.emailService.send(job.attrs.data.to);
				}
			}

			const emailService = new EmailService();
			const jobs = new NotificationJobs(emailService);

			registerJobs(agenda, [jobs]);

			expect(agenda.definitions['notifications.sendEmail']).toBeDefined();

			// Verify the handler can access the injected service
			const mockJob = { attrs: { data: { to: 'test@example.com' } } } as Job<{ to: string }>;
			const definition = agenda.definitions['notifications.sendEmail'];
			await (definition.fn as (job: Job<{ to: string }>) => Promise<void>)(mockJob);

			expect(sentEmails).toEqual(['test@example.com']);
		});
	});
});
