/* eslint-disable no-console */
import { Db } from 'mongodb';
import * as delay from 'delay';
import { mockMongo } from './helpers/mock-mongodb';

import { Agenda } from '../src';

// agenda instances
let agenda: Agenda;
// mongo db connection db instance
let mongoDb: Db;

const clearJobs = async (): Promise<void> => {
	if (mongoDb) {
		await mongoDb.collection('agendaJobs').deleteMany({});
	}
};

const jobType = 'do work';
const jobProcessor = () => { };

describe('Retry', () => {
	beforeEach(async () => {
		if (!mongoDb) {
			const mockedMongo = await mockMongo();
			mongoDb = mockedMongo.mongo.db();
		}

		return new Promise(resolve => {
			agenda = new Agenda(
				{
					mongo: mongoDb
				},
				async () => {
					await delay(50);
					await clearJobs();
					agenda.define('someJob', jobProcessor);
					agenda.define('send email', jobProcessor);
					agenda.define('some job', jobProcessor);
					agenda.define(jobType, jobProcessor);
					return resolve();
				}
			);
		});
	});

	afterEach(async () => {
		await delay(50);
		await agenda.stop();
		await clearJobs();
		// await mongoClient.disconnect();
		// await jobs._db.close();
	});

	it('should retry a job', async () => {
		let shouldFail = true;

		agenda.processEvery(100); // Shave 5s off test runtime :grin:
		agenda.define('a job', (_job, done) => {
			if (shouldFail) {
				shouldFail = false;
				return done(new Error('test failure'));
			}

			done();
			return undefined;
		});

		agenda.on('fail:a job', (err, job) => {
			if (err) {
				// Do nothing as this is expected to fail.
			}

			job.schedule('now').save();
		});

		const successPromise = new Promise(resolve => {
      agenda.on('success:a job', resolve)
    });

		await agenda.now('a job');

		await agenda.start();
		await successPromise;
	}).timeout(100000);
});
