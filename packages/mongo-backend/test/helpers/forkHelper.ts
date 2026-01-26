import { Agenda } from 'agenda';
import { MongoBackend } from '../../src/index.js';

process.on('message', message => {
	if (message === 'cancel') {
		process.exit(2);
	} else {
		console.log('got message', message);
	}
});

try {
	// get process arguments (name, jobId and path to agenda definition file)
	const [, , name, jobId, agendaDefinition] = process.argv;

	// set fancy process title
	process.title = `${process.title} (sub worker: ${name}/${jobId})`;

	// initialize Agenda in "forkedWorker" mode
	const agenda = new Agenda({
		backend: new MongoBackend({
			address: process.env.DB_CONNECTION!,
			collection: process.env.DB_COLLECTION || 'agendaJobs'
		}),
		name: `subworker-${name}`,
		forkedWorker: true
	});
	// wait for db connection
	await agenda.ready;

	if (!name || !jobId) {
		throw new Error(`invalid parameters: ${JSON.stringify(process.argv)}`);
	}

	// load job definition
	if (agendaDefinition) {
		const loadDefinition = await import(agendaDefinition);
		(loadDefinition.default || loadDefinition)(agenda, true);
	}

	// run this job now
	await agenda.runForkedJob(jobId);

	// disconnect database and exit
	process.exit(0);
} catch (err) {
	console.error('err', err);
	if (process.send) {
		process.send(JSON.stringify(err));
	}
	process.exit(1);
}
