#!/usr/bin/env node

import { Command } from 'commander';
import { Agenda } from 'agenda';
import { MongoBackend } from '@agendajs/mongo-backend';
import { createServer } from './server.js';
import type { Server } from 'http';

const program = new Command();

program
	.name('agenda-rest')
	.description('REST API server for Agenda job scheduling')
	.version('6.0.0')
	.option('-u, --uri <uri>', 'MongoDB connection URI', 'mongodb://localhost:27017/agenda')
	.option('-c, --collection <collection>', 'MongoDB collection name', 'agendaJobs')
	.option('-p, --port <port>', 'Server port', '4040')
	.option('-k, --api-key <key>', 'API key for authentication (X-API-Key header)')
	.option('-t, --timeout <timeout>', 'Request timeout in milliseconds', '5000')
	.action(async (options) => {
		const port = parseInt(options.port, 10);
		const timeout = parseInt(options.timeout, 10);

		console.log('Starting agenda-rest server...');
		console.log(`MongoDB URI: ${options.uri}`);
		console.log(`Collection: ${options.collection}`);
		console.log(`Port: ${port}`);
		if (options.apiKey) {
			console.log('API Key authentication: enabled');
		}

		// Create Agenda instance
		const agenda = new Agenda({
			backend: new MongoBackend({
				address: options.uri,
				collection: options.collection
			})
		});

		// Wait for connection
		await agenda.ready;
		console.log('Connected to MongoDB');

		// Start the job processor
		await agenda.start();
		console.log('Agenda job processor started');

		// Create and start the server
		const app = createServer({
			agenda,
			apiKey: options.apiKey,
			timeout
		});

		let server: Server;
		await new Promise<void>((resolve) => {
			server = app.listen(port, () => {
				console.log(`\nagenda-rest server listening on http://localhost:${port}`);
				console.log('\nAPI endpoints:');
				console.log('  GET    /api/job          - List job definitions');
				console.log('  POST   /api/job          - Create job definition');
				console.log('  PUT    /api/job/:name    - Update job definition');
				console.log('  DELETE /api/job/:name    - Delete job definition');
				console.log('  POST   /api/job/now      - Run job immediately');
				console.log('  POST   /api/job/once     - Schedule one-time job');
				console.log('  POST   /api/job/every    - Schedule recurring job');
				console.log('  POST   /api/job/cancel   - Cancel jobs');
				console.log('  GET    /api/health       - Health check');
				resolve();
			});
		});

		// Graceful shutdown
		const gracefulShutdown = async () => {
			console.log('\nShutting down gracefully...');
			await new Promise<void>((resolve) => server.close(() => resolve()));
			await agenda.stop();
			console.log('Server stopped');
			process.exit(0);
		};

		process.on('SIGTERM', gracefulShutdown);
		process.on('SIGINT', gracefulShutdown);
	});

program.parse();
