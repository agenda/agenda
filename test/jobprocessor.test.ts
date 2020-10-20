import { expect } from 'chai';

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

describe('JobProcessor', () => {
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
		for (let i = 0; i < 100; i += 1) {
			agenda.now('test long');
		}

		await new Promise(resolve => setTimeout(resolve, 1000));

		// queue more short ones (they should complete first!)
		for (let j = 0; j < 100; j += 1) {
			agenda.now('test short');
		}

		await new Promise(resolve => setTimeout(resolve, 1000));

		expect(shortOneFinished).to.be.equal(true);
	});

	it('ensure slow jobs time out', async () => {
		agenda.define(
			'test long',
			async () => {
				await new Promise(resolve => setTimeout(resolve, 1000));
			},
			{ lockLifetime: 500 }
		);

		await agenda.start();

		// queue up long ones
		agenda.now('test long');

		const promiseResult = await new Promise(resolve => {
			agenda.on('error', err => {
				resolve(err);
			});

			agenda.on('success', () => {
				resolve();
			});
		});

		expect(promiseResult).to.be.an('error');
	});

	it('ensure slow jobs do not time out when calling touch', async () => {
		agenda.define(
			'test long',
			async job => {
				for (let i = 0; i < 10; i += 1) {
					await new Promise(resolve => setTimeout(resolve, 100));
					await job.touch();
				}
			},
			{ lockLifetime: 500 }
		);

		await agenda.start();

		// queue up long ones
		agenda.now('test long');

		const promiseResult = await new Promise(resolve => {
			agenda.on('error', err => {
				resolve(err);
			});

			agenda.on('success', () => {
				resolve();
			});
		});

		expect(promiseResult).to.not.be.an('error');
	});

	it('ensure concurrency is filled up', async () => {
		agenda.maxConcurrency(300);
		agenda.lockLimit(150);
		agenda.defaultLockLimit(20);
		agenda.defaultConcurrency(10);

		for (let jobI = 0; jobI < 10; jobI += 1) {
			agenda.define(
				`test job ${jobI}`,
				async () => {
					await new Promise(resolve => setTimeout(resolve, 5000));
				},
				{ lockLifetime: 10000 }
			);
		}

		// queue up jobs
		for (let jobI = 0; jobI < 10; jobI += 1) {
			for (let jobJ = 0; jobJ < 25; jobJ += 1) {
				agenda.now(`test job ${jobI}`);
			}
		}

		await agenda.start();

		const allJobsStarted = new Promise(async resolve => {
			let runningJobs = 0;
			do {
				runningJobs = (await agenda.getRunningStats()).runningJobs as number;
				await new Promise(wait => setTimeout(wait, 50));
			} while (runningJobs < 100);
			resolve('all started');
		});

		expect(
			await Promise.race([allJobsStarted, new Promise(resolve => setTimeout(resolve, 1500))])
		).to.equal('all started');
	});
});
