/**
 * Agenda Decorators Example
 *
 * This example demonstrates how to use TypeScript decorators to define job handlers
 * in a more declarative way, similar to @tsed/agenda but framework-agnostic.
 *
 * Run with: npx tsx examples/decorators.ts
 */

import { Agenda, JobsController, Define, Every, registerJobs, Job } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';

// ============================================================================
// Example 1: Basic Job Definitions
// ============================================================================

/**
 * Email-related jobs grouped under the "email" namespace.
 * All job names will be prefixed with "email." (e.g., "email.sendWelcome")
 */
@JobsController({ namespace: 'email' })
class EmailJobs {
	/**
	 * Send a welcome email to a new user.
	 * This job must be scheduled manually using agenda.now() or agenda.schedule()
	 */
	@Define({
		concurrency: 5, // Allow 5 concurrent executions
		priority: 'high' // Process before lower priority jobs
	})
	async sendWelcome(job: Job<{ userId: string; email: string }>) {
		const { userId, email } = job.attrs.data;
		console.log(`Sending welcome email to ${email} (user: ${userId})`);

		// Simulate sending email
		await new Promise(resolve => setTimeout(resolve, 100));
		console.log(`Welcome email sent to ${email}`);
	}

	/**
	 * Clean up bounced emails every hour.
	 * This job is automatically scheduled when registered.
	 */
	@Every('1 hour', { name: 'cleanupBounced' })
	async cleanupBouncedEmails(job: Job) {
		console.log('Cleaning up bounced emails...');
		// Cleanup logic here
	}

	/**
	 * Send daily digest to all subscribed users.
	 * Runs every day at 9 AM in New York timezone.
	 */
	@Every('0 9 * * *', {
		name: 'dailyDigest',
		timezone: 'America/New_York'
	})
	async sendDailyDigest(job: Job) {
		console.log('Sending daily digest to all subscribers...');
	}
}

// ============================================================================
// Example 2: Jobs with Dependencies (Dependency Injection)
// ============================================================================

/**
 * Simulated email service
 */
class EmailService {
	async send(to: string, subject: string, body: string): Promise<void> {
		console.log(`[EmailService] Sending to: ${to}, Subject: ${subject}`);
		await new Promise(resolve => setTimeout(resolve, 50));
	}
}

/**
 * Simulated analytics service
 */
class AnalyticsService {
	async track(event: string, data: Record<string, unknown>): Promise<void> {
		console.log(`[Analytics] Event: ${event}`, data);
	}
}

/**
 * Notification jobs that use injected services.
 * Dependencies are passed via constructor, making testing easy.
 */
@JobsController({ namespace: 'notifications' })
class NotificationJobs {
	constructor(
		private emailService: EmailService,
		private analytics: AnalyticsService
	) {}

	@Define({ concurrency: 10 })
	async sendNotification(
		job: Job<{
			type: 'email' | 'push';
			recipient: string;
			message: string;
		}>
	) {
		const { type, recipient, message } = job.attrs.data;

		if (type === 'email') {
			await this.emailService.send(recipient, 'Notification', message);
		}

		await this.analytics.track('notification_sent', {
			type,
			recipient,
			jobId: job.attrs._id
		});
	}
}

// ============================================================================
// Example 3: Report Generation Jobs
// ============================================================================

interface ReportData {
	reportType: string;
	dateRange: { start: string; end: string };
	format: 'pdf' | 'csv' | 'json';
}

@JobsController({ namespace: 'reports' })
class ReportJobs {
	/**
	 * Generate a custom report on demand.
	 * Supports long-running operations with progress tracking.
	 */
	@Define({
		lockLifetime: 30 * 60 * 1000, // 30 minute lock for long reports
		concurrency: 2
	})
	async generateReport(job: Job<ReportData>) {
		const { reportType, dateRange, format } = job.attrs.data;

		console.log(`Generating ${reportType} report (${format})...`);
		console.log(`Date range: ${dateRange.start} to ${dateRange.end}`);

		// Simulate progress
		for (let i = 0; i <= 100; i += 20) {
			await job.touch(i); // Update progress and extend lock
			console.log(`Progress: ${i}%`);
			await new Promise(resolve => setTimeout(resolve, 100));
		}

		console.log('Report generated!');
	}

	/**
	 * Generate weekly summary report every Monday at 9 AM.
	 */
	@Every('0 9 * * MON', {
		name: 'weeklySummary',
		timezone: 'UTC'
	})
	async generateWeeklySummary(job: Job) {
		console.log('Generating weekly summary report...');
	}
}

// ============================================================================
// Main: Register and Run
// ============================================================================

async function main() {
	// Create Agenda instance with MongoDB backend
	const agenda = new Agenda({
		backend: new MongoBackend({
			address: 'mongodb://127.0.0.1:27017/agenda-decorators-example'
		})
	});

	// Always attach error handler
	agenda.on('error', err => {
		console.error('Agenda error:', err);
	});

	// Create service instances (in a real app, these might come from a DI container)
	const emailService = new EmailService();
	const analytics = new AnalyticsService();

	// Create job controller instances with their dependencies
	const emailJobs = new EmailJobs();
	const notificationJobs = new NotificationJobs(emailService, analytics);
	const reportJobs = new ReportJobs();

	// Register all job controllers with Agenda
	registerJobs(agenda, [emailJobs, notificationJobs, reportJobs]);

	// Log registered jobs
	console.log('Registered job definitions:');
	for (const [name, def] of Object.entries(agenda.definitions)) {
		console.log(`  - ${name} (concurrency: ${def.concurrency})`);
	}

	// Start the job processor
	await agenda.start();
	console.log('\nAgenda started! Processing jobs...\n');

	// Schedule some jobs programmatically
	await agenda.now('email.sendWelcome', {
		userId: 'user-123',
		email: 'newuser@example.com'
	});

	await agenda.now('notifications.sendNotification', {
		type: 'email',
		recipient: 'admin@example.com',
		message: 'A new user signed up!'
	});

	await agenda.schedule('in 5 seconds', 'reports.generateReport', {
		reportType: 'sales',
		dateRange: { start: '2024-01-01', end: '2024-01-31' },
		format: 'pdf'
	});

	// Let jobs run for a while
	await new Promise(resolve => setTimeout(resolve, 15000));

	// Graceful shutdown
	console.log('\nShutting down...');
	await agenda.drain();
	console.log('Done!');
}

// Run the example
main().catch(console.error);
