import * as expect from 'expect.js';

import { Db } from 'mongodb';
import { Agenda } from '../src';
import { mockMongo } from './helpers/mock-mongodb';

// Create agenda instances
let agenda: Agenda;
// mongo db connection db instance
let mongoDb: Db;

const clearJobs = async () => {
	if (mongoDb) {
		await mongoDb.collection('agendaJobs').deleteMany({});
	}
};

describe('Agenda', function () {
	// this.timeout(1000000);

	beforeEach(async () => {
		if (!mongoDb) {
			const mockedMongo = await mockMongo();
			// mongoCfg = mockedMongo.uri;
			mongoDb = mockedMongo.mongo.db();
		}

		return new Promise(resolve => {
			agenda = new Agenda(
				{
					mongo: mongoDb,
					maxConcurrency: 4,
					defaultConcurrency: 1,
					lockLimit: 15,
					defaultLockLimit: 6,
					processEvery: '1 second'
				},
				async () => {
					await clearJobs();
					return resolve();
				}
			);
		});
	});

	afterEach(async () => {
		await agenda.stop();
		await clearJobs();
	});

	describe('configuration methods', () => {
		it('ensure new jobs are always filling up running queue', async () => {
			let shortOneFinished = false;

			agenda.define('test long', async () => {
				await new Promise(resolve => setTimeout(resolve, 1000));
			});
			agenda.define('test short', async () => {
				shortOneFinished = true;
				await new Promise(resolve => setTimeout(resolve, 5));
			});

			await agenda.start();

			// queue up long ones
			for (let i = 0; i < 100; i++) {
				agenda.now('test long');
			}

			await new Promise(resolve => setTimeout(resolve, 1000));

			// queue more short ones (they should complete first!)
			for (let j = 0; j < 100; j++) {
				agenda.now('test short');
			}

			await new Promise(resolve => setTimeout(resolve, 1000));

			expect(shortOneFinished).to.be(true);
		});
	});
});
