/* eslint-disable no-console */
import * as path from 'path';
import * as cp from 'child_process';
import { expect } from 'chai';
import { DateTime } from 'luxon';
import { Db } from 'mongodb';

import * as Q from 'q';
import * as delay from 'delay';
import * as sinon from 'sinon';
import { fail } from 'assert';
import { Job } from '../src/Job';
import { Agenda } from '../src';
import { mockMongo } from './helpers/mock-mongodb';

// Create agenda instances
let agenda: Agenda;
// connection string to mongodb
let mongoCfg: string;
// mongo db connection db instance
let mongoDb: Db;

const clearJobs = async () => {
	if (mongoDb) {
		await mongoDb.collection('agendaJobs').deleteMany({});
	}
};

// Slow timeouts for Travis
const jobTimeout = 500;
const jobType = 'do work';
const jobProcessor = () => { };

describe('Job', () => {
	beforeEach(async () => {
		if (!mongoDb) {
			const mockedMongo = await mockMongo();
			mongoCfg = mockedMongo.uri;
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

	describe('repeatAt', () => {
		const job = new Job(agenda, { name: 'demo', type: 'normal' });
		it('sets the repeat at', () => {
			job.repeatAt('3:30pm');
			expect(job.attrs.repeatAt).to.equal('3:30pm');
		});
		it('returns the job', () => {
			expect(job.repeatAt('3:30pm')).to.equal(job);
		});
	});

	describe('toJSON', () => {
		it('failedAt', () => {
			let job = new Job(agenda, {
				name: 'demo',
				type: 'normal',
				nextRunAt: null,
				failedAt: null as any
			});
			expect(job.toJson().failedAt).to.be.not.a('Date');

			job = new Job(agenda, {
				name: 'demo',
				type: 'normal',
				nextRunAt: null,
				failedAt: new Date()
			});
			expect(job.toJson().failedAt).to.be.a('Date');
		});
	});

	describe('unique', () => {
		const job = new Job(agenda, { name: 'demo', type: 'normal' });
		it('sets the unique property', () => {
			job.unique({ 'data.type': 'active', 'data.userId': '123' });
			expect(JSON.stringify(job.attrs.unique)).to.equal(
				JSON.stringify({ 'data.type': 'active', 'data.userId': '123' })
			);
		});
		it('returns the job', () => {
			expect(job.unique({ 'data.type': 'active', 'data.userId': '123' })).to.equal(job);
		});
	});

	describe('repeatEvery', () => {
		const job = new Job(agenda, { name: 'demo', type: 'normal' });
		it('sets the repeat interval', () => {
			job.repeatEvery(5000);
			expect(job.attrs.repeatInterval).to.equal(5000);
		});
		it('returns the job', () => {
			expect(job.repeatEvery('one second')).to.equal(job);
		});
		it('sets the nextRunAt property with skipImmediate', () => {
			const job2 = new Job(agenda, { name: 'demo', type: 'normal' });
			const now = new Date().valueOf();
			job2.repeatEvery('3 minutes', { skipImmediate: true });
			expect(job2.attrs.nextRunAt).to.be.within(new Date(now + 180000), new Date(now + 180002)); // Inclusive
		});
		it('repeats from the existing nextRunAt property with skipImmediate', () => {
			const job2 = new Job(agenda, { name: 'demo', type: 'normal' });
			const futureDate = new Date('3000-01-01T00:00:00');
			job2.attrs.nextRunAt = futureDate;
			job2.repeatEvery('3 minutes', { skipImmediate: true });
			expect(job2.attrs.nextRunAt!.getTime()).to.equal(futureDate.getTime() + 180000);
		});
		it('repeats from the existing scheduled date with skipImmediate', () => {
			const futureDate = new Date('3000-01-01T00:00:00');
			const job2 = new Job(agenda, { name: 'demo', type: 'normal' }).schedule(futureDate);
			job2.repeatEvery('3 minutes', { skipImmediate: true });
			expect(job2.attrs.nextRunAt!.getTime()).to.equal(futureDate.valueOf() + 180000);
		});
	});

	describe('schedule', () => {
		let job;
		beforeEach(() => {
			job = new Job(agenda, { name: 'demo', type: 'normal' });
		});
		it('sets the next run time', () => {
			job.schedule('in 5 minutes');
			expect(job.attrs.nextRunAt).to.be.an.instanceof(Date);
		});
		it('sets the next run time Date object', () => {
			const when = new Date(Date.now() + 1000 * 60 * 3);
			job.schedule(when);
			expect(job.attrs.nextRunAt).to.be.an.instanceof(Date);
			expect(job.attrs.nextRunAt.getTime()).to.eql(when.getTime());
		});
		it('returns the job', () => {
			expect(job.schedule('tomorrow at noon')).to.equal(job);
		});
		it('understands ISODates on the 30th', () => {
			// https://github.com/agenda/agenda/issues/807
			expect(job.schedule('2019-04-30T22:31:00.00Z').attrs.nextRunAt.getTime()).to.equal(
				1556663460000
			);
		});
	});

	describe('priority', () => {
		let job;
		beforeEach(() => {
			job = new Job(agenda, { name: 'demo', type: 'normal' });
		});
		it('sets the priority to a number', () => {
			job.priority(10);
			expect(job.attrs.priority).to.equal(10);
		});
		it('returns the job', () => {
			expect(job.priority(50)).to.equal(job);
		});
		it('parses written priorities', () => {
			job.priority('high');
			expect(job.attrs.priority).to.equal(10);
		});
	});

	describe('computeNextRunAt', () => {
		let job: Job;

		beforeEach(() => {
			job = new Job(agenda, { name: 'demo', type: 'normal' });
		});

		it('returns the job', () => {
			const jobProto = Object.getPrototypeOf(job);
			expect(jobProto.computeNextRunAt.call(job)).to.equal(job);
		});

		it('sets to undefined if no repeat at', () => {
			job.attrs.repeatAt = undefined;
			const jobProto = Object.getPrototypeOf(job);
			jobProto.computeNextRunAt.call(job);
			expect(job.attrs.nextRunAt).to.equal(null);
		});

		it('it understands repeatAt times', () => {
			const d = new Date();
			d.setHours(23);
			d.setMinutes(59);
			d.setSeconds(0);
			job.attrs.repeatAt = '11:59pm';
			const jobProto = Object.getPrototypeOf(job);
			jobProto.computeNextRunAt.call(job);
			expect(job.attrs.nextRunAt?.getHours()).to.equal(d.getHours());
			expect(job.attrs.nextRunAt?.getMinutes()).to.equal(d.getMinutes());
		});

		it('sets to undefined if no repeat interval', () => {
			job.attrs.repeatInterval = undefined;
			const jobProto = Object.getPrototypeOf(job);
			jobProto.computeNextRunAt.call(job);
			expect(job.attrs.nextRunAt).to.equal(null);
		});

		it('it understands human intervals', () => {
			const now = new Date();
			job.attrs.lastRunAt = now;
			job.repeatEvery('2 minutes');
			const jobProto = Object.getPrototypeOf(job);
			jobProto.computeNextRunAt.call(job);
			expect(job.attrs.nextRunAt?.getTime()).to.equal(now.valueOf() + 120000);
		});

		it('understands cron intervals', () => {
			const now = new Date();
			now.setMinutes(1);
			now.setMilliseconds(0);
			now.setSeconds(0);
			job.attrs.lastRunAt = now;
			job.repeatEvery('*/2 * * * *');
			const jobProto = Object.getPrototypeOf(job);
			jobProto.computeNextRunAt.call(job);
			expect(job.attrs.nextRunAt?.valueOf()).to.equal(now.valueOf() + 60000);
		});

		it('understands cron intervals with a timezone', () => {
			const date = new Date('2015-01-01T06:01:00-00:00');
			job.attrs.lastRunAt = date;
			job.repeatEvery('0 6 * * *', {
				timezone: 'GMT'
			});
			const jobProto = Object.getPrototypeOf(job);
			jobProto.computeNextRunAt.call(job);
			expect(DateTime.fromJSDate(job.attrs.nextRunAt!).setZone('GMT').hour).to.equal(6);
			expect(DateTime.fromJSDate(job.attrs.nextRunAt!).toJSDate().getDate()).to.equal(
				DateTime.fromJSDate(job.attrs.lastRunAt!).plus({days: 1}).toJSDate().getDate()
			);
		});

		it('understands cron intervals with a timezone when last run is the same as the interval', () => {
			const date = new Date('2015-01-01T06:00:00-00:00');
			job.attrs.lastRunAt = date;
			job.repeatEvery('0 6 * * *', {
				timezone: 'GMT'
			});
			const jobProto = Object.getPrototypeOf(job);
			jobProto.computeNextRunAt.call(job);
			expect(DateTime.fromJSDate(job.attrs.nextRunAt!).setZone('GMT').hour).to.equal(6);
			expect(DateTime.fromJSDate(job.attrs.nextRunAt!).toJSDate().getDate()).to.equal(
				DateTime.fromJSDate(job.attrs.lastRunAt!).plus({day: 1}).toJSDate().getDate()
			);
		});

		it('gives the correct nextDate when the lastRun is 1ms before the expected time', () => {
			// (Issue #858): lastRunAt being 1ms before the nextRunAt makes cronTime return the same nextRunAt
			const last = new Date();
			last.setSeconds(59);
			last.setMilliseconds(999);
			const next = new Date(last.valueOf() + 1);
			const expectedDate = new Date(next.valueOf() + 60000);
			job.attrs.lastRunAt = last;
			job.attrs.nextRunAt = next;
			job.repeatEvery('* * * * *', {
				timezone: 'GMT'
			});
			const jobProto = Object.getPrototypeOf(job);
			jobProto.computeNextRunAt.call(job);
			expect(job.attrs.nextRunAt.valueOf()).to.equal(expectedDate.valueOf());
		});

		it('cron job with month starting at 1', async () => {
			job.repeatEvery('0 0 * 1 *', {
				timezone: 'GMT'
			});
			if (job.attrs.nextRunAt) {
				expect(job.attrs.nextRunAt.getMonth()).to.equal(0);
			} else {
				fail();
			}
		});

		it('repeating job with cron', async () => {
			job.repeatEvery('0 0 * 1 *', {
				timezone: 'GMT'
			});
			expect(job.attrs.nextRunAt).to.not.eql(null);
		});

		describe('when repeat at time is invalid', () => {
			beforeEach(() => {
				job.attrs.repeatAt = 'foo';
				const jobProto = Object.getPrototypeOf(job);
				jobProto.computeNextRunAt.call(job);
			});

			it('sets nextRunAt to null', () => {
				expect(job.attrs.nextRunAt).to.equal(null);
			});

			it('fails the job', () => {
				expect(job.attrs.failReason).to.equal(
					'failed to calculate repeatAt time due to invalid format'
				);
			});
		});

		describe('when repeat interval is invalid', () => {
			beforeEach(() => {
				job.attrs.repeatInterval = 'asd';
				const jobProto = Object.getPrototypeOf(job);
				jobProto.computeNextRunAt.call(job);
			});

			it('sets nextRunAt to null', () => {
				expect(job.attrs.nextRunAt).to.equal(null);
			});

			it('fails the job', () => {
				expect(job.attrs.failReason).to.equal(
					'failed to calculate nextRunAt due to invalid repeat interval'
				);
			});
		});
	});

	describe('remove', () => {
		it('removes the job', async () => {
			const job = new Job(agenda, {
				name: 'removed job',
				type: 'normal'
			});
			await job.save();
			const resultSaved = await mongoDb
				.collection('agendaJobs')
				.find({
					_id: job.attrs._id
				})
				.toArray();

			expect(resultSaved).to.have.length(1);
			await job.remove();

			const resultDeleted = await mongoDb
				.collection('agendaJobs')
				.find({
					_id: job.attrs._id
				})
				.toArray();

			expect(resultDeleted).to.have.length(0);
		});
	});

	describe('run', () => {
		let job;

		beforeEach(() => {
			agenda.define('testRun', (job, done) => {
				setTimeout(() => {
					done();
				}, 100);
			});

			job = new Job(agenda, { name: 'testRun', type: 'normal' });
		});

		it('updates lastRunAt', async () => {
			const now = new Date();
			await delay(5);
			await job.run();

			expect(job.attrs.lastRunAt.valueOf()).to.greaterThan(now.valueOf());
		});

		it('fails if job is undefined', async () => {
			job = new Job(agenda, { name: 'not defined', type: 'normal' });
			await job.run().catch(error => {
				expect(error.message).to.equal('Undefined job');
			});
			expect(job.attrs.failedAt).to.not.be.undefined;
			expect(job.attrs.failReason).to.equal('Undefined job');
		});

		it('updates nextRunAt', async () => {
			const now = new Date();
			job.repeatEvery('10 minutes');
			await delay(5);
			await job.run();
			expect(job.attrs.nextRunAt.valueOf()).to.greaterThan(now.valueOf() + 59999);
		});

		it('handles errors', async () => {
			job.attrs.name = 'failBoat';
			agenda.define('failBoat', () => {
				throw new Error('Zomg fail');
			});
			await job.run();
			expect(job.attrs.failReason).to.equal('Zomg fail');
		});

		it('handles errors with q promises', async () => {
			job.attrs.name = 'failBoat2';
			agenda.define('failBoat2', (job, cb) => {
				Q.delay(100)
					.then(() => {
						throw new Error('Zomg fail');
					})
					.fail(cb)
					.done();
			});
			await job.run();
			expect(job.attrs.failReason).to.not.be.undefined;
		});

		it('allows async functions', async () => {
			job.attrs.name = 'async';

			const successSpy = sinon.stub();
			let finished = false;

			agenda.once('success:async', successSpy);

			agenda.define('async', async () => {
				await delay(5);
				finished = true;
			});

			expect(finished).to.equal(false);
			await job.run();
			expect(successSpy.callCount).to.equal(1);
			expect(finished).to.equal(true);
		});

		it('handles errors from async functions', async () => {
			job.attrs.name = 'asyncFail';

			const failSpy = sinon.stub();
			const err = new Error('failure');

			agenda.once('fail:asyncFail', failSpy);

			agenda.define('asyncFail', async () => {
				await delay(5);
				throw err;
			});

			await job.run();
			expect(failSpy.callCount).to.equal(1);
			expect(failSpy.calledWith(err)).to.equal(true);
		});

		it('waits for the callback to be called even if the function is async', async () => {
			job.attrs.name = 'asyncCb';

			const successSpy = sinon.stub();
			let finishedCb = false;

			agenda.once('success:asyncCb', successSpy);

			agenda.define('asyncCb', async (job, cb) => {
				(async () => {
					await delay(5);
					finishedCb = true;
					cb();
				})();
			});

			await job.run();
			expect(finishedCb).to.equal(true);
			expect(successSpy.callCount).to.equal(1);
		});

		it("uses the callback error if the function is async and didn't reject", async () => {
			job.attrs.name = 'asyncCbError';

			const failSpy = sinon.stub();
			const err = new Error('failure');

			agenda.once('fail:asyncCbError', failSpy);

			agenda.define('asyncCbError', async (job, cb) => {
				(async () => {
					await delay(5);
					cb(err);
				})();
			});

			await job.run();
			expect(failSpy.callCount).to.equal(1);
			expect(failSpy.calledWith(err)).to.equal(true);
		});

		it('favors the async function error over the callback error if it comes first', async () => {
			job.attrs.name = 'asyncCbTwoError';

			const failSpy = sinon.stub();
			const fnErr = new Error('functionFailure');
			const cbErr = new Error('callbackFailure');

			agenda.on('fail:asyncCbTwoError', failSpy);

			agenda.define('asyncCbTwoError', async (job, cb) => {
				(async () => {
					await delay(5);
					cb(cbErr);
				})();

				throw fnErr;
			});

			await job.run();
			expect(failSpy.callCount).to.equal(1);
			expect(failSpy.calledWith(fnErr)).to.equal(true);
			expect(failSpy.calledWith(cbErr)).to.equal(false);
		});

		it('favors the callback error over the async function error if it comes first', async () => {
			job.attrs.name = 'asyncCbTwoErrorCb';

			const failSpy = sinon.stub();
			const fnErr = new Error('functionFailure');
			const cbErr = new Error('callbackFailure');

			agenda.on('fail:asyncCbTwoErrorCb', failSpy);

			agenda.define('asyncCbTwoErrorCb', async (job, cb) => {
				cb(cbErr);
				await delay(5);
				throw fnErr;
			});

			await job.run();
			expect(failSpy.callCount).to.equal(1);
			expect(failSpy.calledWith(cbErr)).to.equal(true);
			expect(failSpy.calledWith(fnErr)).to.equal(false);
		});

		it("doesn't allow a stale job to be saved", async () => {
			job.attrs.name = 'failBoat3';
			await job.save();
			agenda.define('failBoat3', async (job, cb) => {
				// Explicitly find the job again,
				// so we have a new job object
				const jobs = await agenda.jobs({ name: 'failBoat3' });
				expect(jobs).to.have.length(1);
				await jobs[0].remove();
				cb();
			});

			await job.run();

			// Expect the deleted job to not exist in the database
			const deletedJob = await agenda.jobs({ name: 'failBoat3' });
			expect(deletedJob).to.have.length(0);
		});
	});

	describe('touch', () => {
		it('extends the lock lifetime', async () => {
			const lockedAt = new Date();
			const job = new Job(agenda, { name: 'some job', type: 'normal', lockedAt });
			await delay(2);
			await job.touch();
			expect(job.attrs.lockedAt).to.greaterThan(lockedAt);
		});
	});

	describe('fail', () => {
		const job = new Job(agenda, { name: 'demo', type: 'normal' });
		it('takes a string', () => {
			job.fail('test');
			expect(job.attrs.failReason).to.equal('test');
		});
		it('takes an error object', () => {
			job.fail(new Error('test'));
			expect(job.attrs.failReason).to.equal('test');
		});
		it('sets the failedAt time', () => {
			job.fail('test');
			expect(job.attrs.failedAt).to.be.an.instanceof(Date);
		});
		it('sets the failedAt time equal to lastFinishedAt time', () => {
			job.fail('test');
			expect(job.attrs.failedAt).to.equal(job.attrs.lastFinishedAt);
		});
	});

	describe('enable', () => {
		it('sets disabled to false on the job', () => {
			const job = new Job(agenda, { name: 'test', type: 'normal', disabled: true });
			job.enable();
			expect(job.attrs.disabled).to.equal(false);
		});

		it('returns the job', () => {
			const job = new Job(agenda, { name: 'test', type: 'normal', disabled: true });
			expect(job.enable()).to.equal(job);
		});
	});

	describe('disable', () => {
		it('sets disabled to true on the job', () => {
			const job = new Job(agenda, { name: 'demo', type: 'normal' });
			job.disable();
			expect(job.attrs.disabled).to.be.true;
		});
		it('returns the job', () => {
			const job = new Job(agenda, { name: 'demo', type: 'normal' });
			expect(job.disable()).to.equal(job);
		});
	});

	describe('save', () => {
		/** this is undocumented, and therefore we remvoe it
		it('calls saveJob on the agenda', done => {
			const oldSaveJob = agenda.saveJob;
			agenda.saveJob = () => {
				agenda.saveJob = oldSaveJob;
				done();
			};

			const job = agenda.create('some job', {
				wee: 1
			});
			job.save();
		}); */

		it('doesnt save the job if its been removed', async () => {
			const job = agenda.create('another job');
			// Save, then remove, then try and save again.
			// The second save should fail.
			const j = await job.save();
			await j.remove();
			await j.save();

			const jobs = await agenda.jobs({ name: 'another job' });
			expect(jobs).to.have.length(0);
		});

		it('returns the job', async () => {
			const job = agenda.create('some job', {
				wee: 1
			});
			expect(await job.save()).to.equal(job);
		});
	});

	describe('start/stop', () => {
		it('starts/stops the job queue', async () => {
			const processed = new Promise(resolve => {
				agenda.define('jobQueueTest', async _job => {
					resolve('processed');
				});
			});
			await agenda.every('1 second', 'jobQueueTest');
			agenda.processEvery('1 second');
			await agenda.start();

			expect(
				await Promise.race([
					processed,
					new Promise(resolve => setTimeout(() => resolve(`not processed`), 1100))
				])
			).to.eq('processed');

			await agenda.stop();
			const processedStopped = new Promise<void>(resolve => {
				agenda.define('jobQueueTest', async _job => {
					resolve();
				});
			});

			expect(
				await Promise.race([
					processedStopped,
					new Promise(resolve => setTimeout(() => resolve(`not processed`), 1100))
				])
			).to.eq('not processed');
		});

		it('does not run disabled jobs', async () => {
			let ran = false;
			agenda.define('disabledJob', () => {
				ran = true;
			});

			const job = await agenda.create('disabledJob').disable().schedule('now');
			await job.save();
			await agenda.start();
			await delay(jobTimeout);

			expect(ran).to.equal(false);

			await agenda.stop();
		});

		it('does not throw an error trying to process undefined jobs', async () => {
			await agenda.start();
			const job = agenda.create('jobDefinedOnAnotherServer').schedule('now');

			await job.save();

			await delay(jobTimeout);
			await agenda.stop();
		});

		it('clears locks on stop', async () => {
			agenda.define('longRunningJob', (_job, _cb) => {
				// eslint-disable-line no-unused-vars
				// Job never finishes
			});
			agenda.every('10 seconds', 'longRunningJob');
			agenda.processEvery('1 second');

			await agenda.start();
			await delay(jobTimeout);
			const jobStarted = await agenda.db.getJobs({ name: 'longRunningJob' });
			expect(jobStarted[0].lockedAt).to.not.equal(null);
			await agenda.stop();
			const job = await agenda.db.getJobs({ name: 'longRunningJob' });
			expect(job[0].lockedAt).to.equal(undefined);
		});

		describe('events', () => {
			beforeEach(() => {
				agenda.define('jobQueueTest', (_job, cb) => {
					cb();
				});
				agenda.define('failBoat', () => {
					throw new Error('Zomg fail');
				});
			});

			it('emits start event', async () => {
				const spy = sinon.spy();
				const job = new Job(agenda, { name: 'jobQueueTest', type: 'normal' });
				agenda.once('start', spy);

				await job.run();
				expect(spy.called).to.be.true;
				expect(spy.calledWithExactly(job)).to.be.true;
			});

			it('emits start:job name event', async () => {
				const spy = sinon.spy();
				const job = new Job(agenda, { name: 'jobQueueTest', type: 'normal' });
				agenda.once('start:jobQueueTest', spy);

				await job.run();
				expect(spy.called).to.be.true;
				expect(spy.calledWithExactly(job)).to.be.true;
			});

			it('emits complete event', async () => {
				const spy = sinon.spy();
				const job = new Job(agenda, { name: 'jobQueueTest', type: 'normal' });
				agenda.once('complete', spy);

				await job.run();
				expect(spy.called).to.be.true;
				expect(spy.calledWithExactly(job)).to.be.true;
			});

			it('emits complete:job name event', async () => {
				const spy = sinon.spy();
				const job = new Job(agenda, { name: 'jobQueueTest', type: 'normal' });
				agenda.once('complete:jobQueueTest', spy);

				await job.run();
				expect(spy.called).to.be.true;
				expect(spy.calledWithExactly(job)).to.be.true;
			});

			it('emits success event', async () => {
				const spy = sinon.spy();
				const job = new Job(agenda, { name: 'jobQueueTest', type: 'normal' });
				agenda.once('success', spy);

				await job.run();
				expect(spy.called).to.be.true;
				expect(spy.calledWithExactly(job)).to.be.true;
			});

			it('emits success:job name event', async () => {
				const spy = sinon.spy();
				const job = new Job(agenda, { name: 'jobQueueTest', type: 'normal' });
				agenda.once('success:jobQueueTest', spy);

				await job.run();
				expect(spy.called).to.be.true;
				expect(spy.calledWithExactly(job)).to.be.true;
			});

			it('emits fail event', async () => {
				const spy = sinon.spy();
				const job = new Job(agenda, { name: 'failBoat', type: 'normal' });
				agenda.once('fail', spy);

				await job.run().catch(error => {
					expect(error.message).to.equal('Zomg fail');
				});

				expect(spy.called).to.be.true;

				const err = spy.args[0][0];
				expect(err.message).to.equal('Zomg fail');
				expect(job.attrs.failCount).to.equal(1);
				expect(job.attrs.failedAt!.valueOf()).not.to.be.below(job.attrs.lastFinishedAt!.valueOf());
			});

			it('emits fail:job name event', async () => {
				const spy = sinon.spy();
				const job = new Job(agenda, { name: 'failBoat', type: 'normal' });
				agenda.once('fail:failBoat', spy);

				await job.run().catch(error => {
					expect(error.message).to.equal('Zomg fail');
				});

				expect(spy.called).to.be.true;

				const err = spy.args[0][0];
				expect(err.message).to.equal('Zomg fail');
				expect(job.attrs.failCount).to.equal(1);
				expect(job.attrs.failedAt!.valueOf()).to.not.be.below(job.attrs.lastFinishedAt!.valueOf());
			});
		});
	});

	describe('job lock', () => {
		it('runs a recurring job after a lock has expired', async () => {
			const processorPromise = new Promise(resolve => {
				let startCounter = 0;
				agenda.define(
					'lock job',
					async () => {
						startCounter++;

						if (startCounter !== 1) {
							await agenda.stop();
							resolve(startCounter);
						}
					},
					{
						lockLifetime: 50
					}
				);
			});

			expect(agenda.definitions['lock job'].lockLifetime).to.equal(50);

			agenda.defaultConcurrency(100);
			agenda.processEvery(10);
			agenda.every('0.02 seconds', 'lock job');
			await agenda.stop();
			await agenda.start();
			expect(await processorPromise).to.equal(2);
		});

		it('runs a one-time job after its lock expires', async () => {
			const processorPromise = new Promise(resolve => {
				let runCount = 0;

				agenda.define(
					'lock job',
					async _job => {
						runCount++;
						if (runCount === 1) {
							// this should time out
							await new Promise(longResolve => setTimeout(longResolve, 1000));
						} else {
							await new Promise(longResolve => setTimeout(longResolve, 10));
							resolve(runCount);
						}
					},
					{
						lockLifetime: 50,
						concurrency: 1
					}
				);
			});

			let errorHasBeenThrown;
			agenda.on('error', err => {
				errorHasBeenThrown = err;
			});
			agenda.processEvery(25);
			await agenda.start();
			agenda.now('lock job', {
				i: 1
			});
			expect(await processorPromise).to.equal(2);
			expect(errorHasBeenThrown?.message).to.includes("execution of 'lock job' canceled");
		});

		it('does not process locked jobs', async () => {
			const history: any[] = [];

			agenda.define(
				'lock job',
				(job, cb) => {
					history.push(job.attrs.data.i);

					setTimeout(() => {
						cb();
					}, 150);
				},
				{
					lockLifetime: 300
				}
			);

			agenda.processEvery(100);
			await agenda.start();

			await Promise.all([
				agenda.now('lock job', { i: 1 }),
				agenda.now('lock job', { i: 2 }),
				agenda.now('lock job', { i: 3 })
			]);

			await delay(500);
			expect(history).to.have.length(3);
			expect(history).to.contain(1);
			expect(history).to.contain(2);
			expect(history).to.contain(3);
		});

		it('does not on-the-fly lock more than agenda._lockLimit jobs', async () => {
			agenda.lockLimit(1);

			agenda.define('lock job', (job, cb) => {
				/* this job nevers finishes */
			}); // eslint-disable-line no-unused-vars

			await agenda.start();

			await Promise.all([agenda.now('lock job', { i: 1 }), agenda.now('lock job', { i: 2 })]);

			// give it some time to get picked up
			await delay(200);

			expect((await agenda.getRunningStats()).lockedJobs).to.equal(1);
		});

		it('does not on-the-fly lock more than definition.lockLimit jobs', async () => {
			agenda.define('lock job', (job, cb) => { }, { lockLimit: 1 }); // eslint-disable-line no-unused-vars

			await agenda.start();

			await Promise.all([agenda.now('lock job', { i: 1 }), agenda.now('lock job', { i: 2 })]);

			await delay(500);
			expect((await agenda.getRunningStats()).lockedJobs).to.equal(1);
		});

		it('does not lock more than agenda._lockLimit jobs during processing interval', async () => {
			agenda.lockLimit(1);
			agenda.processEvery(200);

			agenda.define('lock job', (job, cb) => { }); // eslint-disable-line no-unused-vars

			await agenda.start();

			const when = DateTime.local().plus({millisecond: 300}).toJSDate();

			await Promise.all([
				agenda.schedule(when, 'lock job', { i: 1 }),
				agenda.schedule(when, 'lock job', { i: 2 })
			]);

			await delay(500);
			expect((await agenda.getRunningStats()).lockedJobs).to.equal(1);
		});

		it('does not lock more than definition.lockLimit jobs during processing interval', async () => {
			agenda.processEvery(200);

			agenda.define('lock job', (job, cb) => { }, { lockLimit: 1 }); // eslint-disable-line no-unused-vars

			await agenda.start();

			const when = DateTime.local().plus({millisecond: 300}).toJSDate();

			await Promise.all([
				agenda.schedule(when, 'lock job', { i: 1 }),
				agenda.schedule(when, 'lock job', { i: 2 })
			]);

			await delay(500);
			expect((await agenda.getRunningStats()).lockedJobs).to.equal(1);
			await agenda.stop();
		});
	});

	describe('job concurrency', () => {
		it('should not block a job for concurrency of another job', async () => {
			agenda.processEvery(50);

			const processed: number[] = [];
			const now = Date.now();

			agenda.define(
				'blocking',
				(job, cb) => {
					processed.push(job.attrs.data.i);
					setTimeout(cb, 400);
				},
				{
					concurrency: 1
				}
			);

			const checkResultsPromise = new Promise<number[]>(resolve => {
				agenda.define(
					'non-blocking',
					job => {
						processed.push(job.attrs.data.i);
						resolve(processed);
					},
					{
						// Lower priority to keep it at the back in the queue
						priority: 'lowest'
					}
				);
			});

			let finished = false;
			agenda.on('complete', () => {
				if (!finished && processed.length === 3) {
					finished = true;
				}
			});

			agenda.start();

			await Promise.all([
				agenda.schedule(new Date(now + 100), 'blocking', { i: 1 }),
				agenda.schedule(new Date(now + 100), 'blocking', { i: 2 }),
				agenda.schedule(new Date(now + 100), 'non-blocking', { i: 3 })
			]);

			try {
				const results: number[] = await Promise.race([
					checkResultsPromise,
					// eslint-disable-next-line prefer-promise-reject-errors
					new Promise<number[]>((_, reject) => setTimeout(() => reject(`not processed`), 2000))
				]);
				expect(results).not.to.contain(2);
			} catch (err) {
				console.log('stats', err, JSON.stringify(await agenda.getRunningStats(), undefined, 3));
				throw err;
			}
		});

		it('should run jobs as first in first out (FIFO)', async () => {
			agenda.processEvery(100);
			agenda.define('fifo', (job, cb) => cb(), { concurrency: 1 });

			const checkResultsPromise = new Promise<number[]>(resolve => {
				const results: number[] = [];

				agenda.on('start:fifo', job => {
					results.push(new Date(job.attrs.nextRunAt!).getTime());
					if (results.length !== 3) {
						return;
					}

					resolve(results);
				});
			});

			await agenda.start();

			await agenda.now('fifo');
			await delay(50);
			await agenda.now('fifo');
			await delay(50);
			await agenda.now('fifo');
			await delay(50);
			try {
				const results: number[] = await Promise.race([
					checkResultsPromise,
					// eslint-disable-next-line prefer-promise-reject-errors
					new Promise<number[]>((_, reject) => setTimeout(() => reject(`not processed`), 2000))
				]);
				expect(results.join('')).to.eql(results.sort().join(''));
			} catch (err) {
				console.log('stats', err, JSON.stringify(await agenda.getRunningStats(), undefined, 3));
				throw err;
			}
		});

		it('should run jobs as first in first out (FIFO) with respect to priority', async () => {
			const now = Date.now();

			agenda.define('fifo-priority', (job, cb) => setTimeout(cb, 100), { concurrency: 1 });

			const checkResultsPromise = new Promise(resolve => {
				const times: number[] = [];
				const priorities: number[] = [];

				agenda.on('start:fifo-priority', job => {
					priorities.push(job.attrs.priority);
					times.push(new Date(job.attrs.lastRunAt!).getTime());
					if (priorities.length !== 3 || times.length !== 3) {
						return;
					}

					resolve({ times, priorities });
				});
			});

			await Promise.all([
				agenda.create('fifo-priority', { i: 1 }).schedule(new Date(now)).priority('high').save(),
				agenda
					.create('fifo-priority', { i: 2 })
					.schedule(new Date(now + 100))
					.priority('low')
					.save(),
				agenda
					.create('fifo-priority', { i: 3 })
					.schedule(new Date(now + 100))
					.priority('high')
					.save()
			]);
			await agenda.start();
			try {
				const { times, priorities } = await Promise.race<any>([
					checkResultsPromise,
					// eslint-disable-next-line prefer-promise-reject-errors
					new Promise<any>((_, reject) => setTimeout(() => reject(`not processed`), 2000))
				]);

				expect(times.join('')).to.eql(times.sort().join(''));
				expect(priorities).to.eql([10, 10, -10]);
			} catch (err) {
				console.log('stats', err, JSON.stringify(await agenda.getRunningStats(), undefined, 3));
				throw err;
			}
		});

		it('should run higher priority jobs first', async () => {
			// Inspired by tests added by @lushc here:
			// <https://github.com/agenda/agenda/pull/451/commits/336ff6445803606a6dc468a6f26c637145790adc>
			const now = new Date();

			agenda.define('priority', (_job, cb) => setTimeout(cb, 10), { concurrency: 1 });

			const checkResultsPromise = new Promise(resolve => {
				const results: number[] = [];

				agenda.on('start:priority', job => {
					results.push(job.attrs.priority);
					if (results.length !== 3) {
						return;
					}

					resolve(results);
				});
			});

			await Promise.all([
				agenda.create('priority').schedule(now).save(),
				agenda.create('priority').schedule(now).priority('low').save(),
				agenda.create('priority').schedule(now).priority('high').save()
			]);
			await agenda.start();
			try {
				const results = await Promise.race([
					checkResultsPromise,
					// eslint-disable-next-line prefer-promise-reject-errors
					new Promise((_, reject) => setTimeout(() => reject(`not processed`), 2000))
				]);
				expect(results).to.eql([10, 0, -10]);
			} catch (err) {
				console.log('stats', JSON.stringify(await agenda.getRunningStats(), undefined, 3));
				throw err;
			}
		});

		it('should support custom sort option', () => {
			const sort = { foo: 1 };
			const agendaSort = new Agenda({ sort });
			expect(agendaSort.attrs.sort).to.eql(sort);
		});
	});

	describe('every running', () => {
		beforeEach(async () => {
			agenda.defaultConcurrency(1);
			agenda.processEvery(5);

			await agenda.stop();
		});

		it('should run the same job multiple times', async () => {
			let counter = 0;

			agenda.define('everyRunTest1', (job, cb) => {
				if (counter < 2) {
					counter++;
				}

				cb();
			});

			await agenda.every(10, 'everyRunTest1');

			await agenda.start();

			await agenda.jobs({ name: 'everyRunTest1' });
			await delay(jobTimeout);
			expect(counter).to.equal(2);

			await agenda.stop();
		});

		it('should reuse the same job on multiple runs', async () => {
			let counter = 0;

			agenda.define('everyRunTest2', (job, cb) => {
				if (counter < 2) {
					counter++;
				}

				cb();
			});
			await agenda.every(10, 'everyRunTest2');

			await agenda.start();

			await delay(jobTimeout);
			const result = await agenda.jobs({ name: 'everyRunTest2' });

			expect(result).to.have.length(1);
			await agenda.stop();
		});
	});

	describe('Integration Tests', () => {
		describe('.every()', () => {
			it('Should not rerun completed jobs after restart', done => {
				let i = 0;

				const serviceError = function (e) {
					done(e);
				};

				const receiveMessage = function (msg) {
					if (msg === 'ran') {
						expect(i).to.equal(0);
						i += 1;
						startService();
					} else if (msg === 'notRan') {
						expect(i).to.equal(1);
						done();
					} else {
						return done(new Error('Unexpected response returned!'));
					}
				};

				const startService = () => {
					const serverPath = path.join(__dirname, 'fixtures', 'agenda-instance.ts');
					const n = cp.fork(serverPath, [mongoCfg, 'daily'], {
						execArgv: ['-r', 'ts-node/register']
					});

					n.on('message', receiveMessage);
					n.on('error', serviceError);
				};

				startService();
			});

			it('Should properly run jobs when defined via an array', done => {
				const serverPath = path.join(__dirname, 'fixtures', 'agenda-instance.ts');
				const n = cp.fork(serverPath, [mongoCfg, 'daily-array'], {
					execArgv: ['-r', 'ts-node/register']
				});

				let ran1 = false;
				let ran2 = false;
				let doneCalled = false;

				const serviceError = function (e) {
					done(e);
				};

				const receiveMessage = function (msg) {
					if (msg === 'test1-ran') {
						ran1 = true;
						if (ran1 && ran2 && !doneCalled) {
							doneCalled = true;
							done();
							return n.send('exit');
						}
					} else if (msg === 'test2-ran') {
						ran2 = true;
						if (ran1 && ran2 && !doneCalled) {
							doneCalled = true;
							done();
							return n.send('exit');
						}
					} else if (!doneCalled) {
						return done(new Error('Jobs did not run!'));
					}
				};

				n.on('message', receiveMessage);
				n.on('error', serviceError);
			});

			it('should not run if job is disabled', async () => {
				let counter = 0;

				agenda.define('everyDisabledTest', (job, cb) => {
					counter++;
					cb();
				});

				const job = await agenda.every(10, 'everyDisabledTest');

				job.disable();

				await job.save();
				await agenda.start();

				await delay(jobTimeout);
				await agenda.jobs({ name: 'everyDisabledTest' });
				expect(counter).to.equal(0);
				await agenda.stop();
			});
		});

		describe('schedule()', () => {
			it('Should not run jobs scheduled in the future', done => {
				let i = 0;

				const serviceError = function (e) {
					done(e);
				};

				const receiveMessage = function (msg) {
					if (msg === 'notRan') {
						if (i < 5) {
							return done();
						}

						i += 1;
						startService();
					} else {
						return done(new Error('Job scheduled in future was ran!'));
					}
				};

				const startService = () => {
					const serverPath = path.join(__dirname, 'fixtures', 'agenda-instance.ts');
					const n = cp.fork(serverPath, [mongoCfg, 'define-future-job'], {
						execArgv: ['-r', 'ts-node/register']
					});

					n.on('message', receiveMessage);
					n.on('error', serviceError);
				};

				startService();
			});

			it('Should run past due jobs when process starts', done => {
				const serviceError = function (e) {
					done(e);
				};

				const receiveMessage = function (msg) {
					if (msg === 'ran') {
						done();
					} else {
						return done(new Error('Past due job did not run!'));
					}
				};

				const startService = () => {
					const serverPath = path.join(__dirname, 'fixtures', 'agenda-instance.ts');
					const n = cp.fork(serverPath, [mongoCfg, 'define-past-due-job'], {
						execArgv: ['-r', 'ts-node/register']
					});

					n.on('message', receiveMessage);
					n.on('error', serviceError);
				};

				startService();
			});

			it('Should schedule using array of names', done => {
				const serverPath = path.join(__dirname, 'fixtures', 'agenda-instance.ts');
				const n = cp.fork(serverPath, [mongoCfg, 'schedule-array'], {
					execArgv: ['-r', 'ts-node/register']
				});

				let ran1 = false;
				let ran2 = false;
				let doneCalled = false;

				const serviceError = err => {
					done(err);
				};

				const receiveMessage = msg => {
					if (msg === 'test1-ran') {
						ran1 = true;
						if (ran1 && ran2 && !doneCalled) {
							doneCalled = true;
							done();
							return n.send('exit');
						}
					} else if (msg === 'test2-ran') {
						ran2 = true;
						if (ran1 && ran2 && !doneCalled) {
							doneCalled = true;
							done();
							return n.send('exit');
						}
					} else if (!doneCalled) {
						return done(new Error('Jobs did not run!'));
					}
				};

				n.on('message', receiveMessage);
				n.on('error', serviceError);
			});
		});

		describe('now()', () => {
			it('Should immediately run the job', done => {
				const serviceError = function (e) {
					done(e);
				};

				const receiveMessage = function (msg) {
					if (msg === 'ran') {
						return done();
					}

					return done(new Error('Job did not immediately run!'));
				};

				const serverPath = path.join(__dirname, 'fixtures', 'agenda-instance.ts');
				const n = cp.fork(serverPath, [mongoCfg, 'now'], { execArgv: ['-r', 'ts-node/register'] });

				n.on('message', receiveMessage);
				n.on('error', serviceError);
			});
		});

		describe('General Integration', () => {
			it('Should not run a job that has already been run', async () => {
				const runCount = {};

				agenda.define('test-job', (job, cb) => {
					const id = job.attrs._id!.toString();

					runCount[id] = runCount[id] ? runCount[id] + 1 : 1;
					cb();
				});

				agenda.processEvery(100);
				await agenda.start();

				await Promise.all([...new Array(10)].map(() => agenda.now('test-job')));

				await delay(jobTimeout);
				const ids = Object.keys(runCount);
				expect(ids).to.have.length(10);
				Object.keys(runCount).forEach(id => {
					expect(runCount[id]).to.equal(1);
				});
			});
		});
	});

	it('checks database for running job on "client"', async () => {
		agenda.define('test', async () => {
			await new Promise(resolve => setTimeout(resolve, 30000));
		});

		const job = await agenda.now('test');
		await agenda.start();

		await new Promise(resolve => agenda.on('start:test', resolve));

		expect(await job.isRunning()).to.be.equal(true);
	});
});
