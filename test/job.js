/* globals describe, it, beforeEach, afterEach */
'use strict';
const path = require('path');
const cp = require('child_process');
const expect = require('expect.js');
const moment = require('moment-timezone');
const MongoClient = require('mongodb').MongoClient;
const Q = require('q');
const delay = require('delay');
const sinon = require('sinon');
const Agenda = require('../index');
const Job = require('../lib/job');

const mongoHost = process.env.MONGODB_HOST || 'localhost';
const mongoPort = process.env.MONGODB_PORT || '27017';
const mongoCfg = 'mongodb://' + mongoHost + ':' + mongoPort + '/agenda-test';

// Create agenda instances
let agenda = null;
let mongo = null;

const clearJobs = () => {
  return new Promise(resolve => {
    mongo.collection('agendaJobs').remove({}, resolve);
  });
};

// Slow timeouts for Travis
const jobTimeout = process.env.TRAVIS ? 2500 : 500;
const jobType = 'do work';
const jobProcessor = () => {};

describe('Job', () => {
  beforeEach(done => {
    agenda = new Agenda({
      db: {
        address: mongoCfg
      }
    }, err => {
      if (err) {
        done(err);
      }
      MongoClient.connect(mongoCfg, async (err, db) => {
        if (err) {
          done(err);
        }
        mongo = db;

        await delay(50);
        await clearJobs();

        agenda.define('someJob', jobProcessor);
        agenda.define('send email', jobProcessor);
        agenda.define('some job', jobProcessor);
        agenda.define(jobType, jobProcessor);
        done();
      });
    });
  });

  afterEach(() => {
    return new Promise(async resolve => {
      await agenda.stop();
      await clearJobs();
      mongo.close(() => {
        agenda._mdb.close(() => {
          return resolve();
        });
      });
    });
  });

  describe('repeatAt', () => {
    const job = new Job();
    it('sets the repeat at', () => {
      job.repeatAt('3:30pm');
      expect(job.attrs.repeatAt).to.be('3:30pm');
    });
    it('returns the job', () => {
      expect(job.repeatAt('3:30pm')).to.be(job);
    });
  });

  describe('unique', () => {
    const job = new Job();
    it('sets the unique property', () => {
      job.unique({'data.type': 'active', 'data.userId': '123'});
      expect(JSON.stringify(job.attrs.unique)).to.be(JSON.stringify({'data.type': 'active', 'data.userId': '123'}));
    });
    it('returns the job', () => {
      expect(job.unique({'data.type': 'active', 'data.userId': '123'})).to.be(job);
    });
  });

  describe('repeatEvery', () => {
    const job = new Job();
    it('sets the repeat interval', () => {
      job.repeatEvery(5000);
      expect(job.attrs.repeatInterval).to.be(5000);
    });
    it('returns the job', () => {
      expect(job.repeatEvery('one second')).to.be(job);
    });
  });

  describe('schedule', () => {
    let job;
    beforeEach(() => {
      job = new Job();
    });
    it('sets the next run time', () => {
      job.schedule('in 5 minutes');
      expect(job.attrs.nextRunAt).to.be.a(Date);
    });
    it('sets the next run time Date object', () => {
      const when = new Date(Date.now() + (1000 * 60 * 3));
      job.schedule(when);
      expect(job.attrs.nextRunAt).to.be.a(Date);
      expect(job.attrs.nextRunAt.getTime()).to.eql(when.getTime());
    });
    it('returns the job', () => {
      expect(job.schedule('tomorrow at noon')).to.be(job);
    });
  });

  describe('priority', () => {
    let job;
    beforeEach(() => {
      job = new Job();
    });
    it('sets the priority to a number', () => {
      job.priority(10);
      expect(job.attrs.priority).to.be(10);
    });
    it('returns the job', () => {
      expect(job.priority(50)).to.be(job);
    });
    it('parses written priorities', () => {
      job.priority('high');
      expect(job.attrs.priority).to.be(10);
    });
  });

  describe('computeNextRunAt', () => {
    let job;

    beforeEach(() => {
      job = new Job();
    });

    it('returns the job', () => {
      expect(job.computeNextRunAt()).to.be(job);
    });

    it('sets to undefined if no repeat at', () => {
      job.attrs.repeatAt = null;
      job.computeNextRunAt();
      expect(job.attrs.nextRunAt).to.be(undefined);
    });

    it('it understands repeatAt times', () => {
      const d = new Date();
      d.setHours(23);
      d.setMinutes(59);
      d.setSeconds(0);
      job.attrs.repeatAt = '11:59pm';
      job.computeNextRunAt();
      expect(job.attrs.nextRunAt.getHours()).to.be(d.getHours());
      expect(job.attrs.nextRunAt.getMinutes()).to.be(d.getMinutes());
    });

    it('sets to undefined if no repeat interval', () => {
      job.attrs.repeatInterval = null;
      job.computeNextRunAt();
      expect(job.attrs.nextRunAt).to.be(undefined);
    });

    it('it understands human intervals', () => {
      const now = new Date();
      job.attrs.lastRunAt = now;
      job.repeatEvery('2 minutes');
      job.computeNextRunAt();
      expect(job.attrs.nextRunAt).to.be(now.valueOf() + 120000);
    });

    it('understands cron intervals', () => {
      const now = new Date();
      now.setMinutes(1);
      now.setMilliseconds(0);
      now.setSeconds(0);
      job.attrs.lastRunAt = now;
      job.repeatEvery('*/2 * * * *');
      job.computeNextRunAt();
      expect(job.attrs.nextRunAt.valueOf()).to.be(now.valueOf() + 60000);
    });

    it('understands cron intervals with a timezone', () => {
      const date = new Date('2015-01-01T06:01:00-00:00');
      job.attrs.lastRunAt = date;
      job.repeatEvery('0 6 * * *', {
        timezone: 'GMT'
      });
      job.computeNextRunAt();
      expect(moment(job.attrs.nextRunAt).tz('GMT').hour()).to.be(6);
      expect(moment(job.attrs.nextRunAt).toDate().getDate()).to.be(moment(job.attrs.lastRunAt).add(1, 'days').toDate().getDate());
    });

    it('understands cron intervals with a timezone when last run is the same as the interval', () => {
      const date = new Date('2015-01-01T06:00:00-00:00');
      job.attrs.lastRunAt = date;
      job.repeatEvery('0 6 * * *', {
        timezone: 'GMT'
      });
      job.computeNextRunAt();
      expect(moment(job.attrs.nextRunAt).tz('GMT').hour()).to.be(6);
      expect(moment(job.attrs.nextRunAt).toDate().getDate()).to.be(moment(job.attrs.lastRunAt).add(1, 'days').toDate().getDate());
    });

    describe('when repeat at time is invalid', () => {
      beforeEach(() => {
        job.attrs.repeatAt = 'foo';
        job.computeNextRunAt();
      });

      it('sets nextRunAt to undefined', () => {
        expect(job.attrs.nextRunAt).to.be(undefined);
      });

      it('fails the job', () => {
        expect(job.attrs.failReason).to.equal('failed to calculate repeatAt time due to invalid format');
      });
    });

    describe('when repeat interval is invalid', () => {
      beforeEach(() => {
        job.attrs.repeatInterval = 'asd';
        job.computeNextRunAt();
      });

      it('sets nextRunAt to undefined', () => {
        expect(job.attrs.nextRunAt).to.be(undefined);
      });

      it('fails the job', () => {
        expect(job.attrs.failReason).to.equal('failed to calculate nextRunAt due to invalid repeat interval');
      });
    });
  });

  describe('remove', () => {
    it('removes the job', done => {
      const job = new Job({
        agenda,
        name: 'removed job'
      });
      job.save().then(() => {});
      job.remove().then(() => {});
      mongo.collection('agendaJobs').find({
        _id: job.attrs._id
      }).toArray((err, j) => {
        if (err) {
          done(err);
        }
        expect(j).to.have.length(0);
        done();
      });
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

      job = new Job({agenda, name: 'testRun'});
    });

    it('updates lastRunAt', async () => {
      const now = new Date();
      await delay(5);
      await job.run();

      expect(job.attrs.lastRunAt.valueOf()).to.be.greaterThan(now.valueOf());
    });

    it('fails if job is undefined', async () => {
      job = new Job({agenda, name: 'not defined'});
      await job.run().catch(err => {
        expect(err.message).to.be('Undefined job');
      });
      expect(job.attrs.failedAt).to.be.ok();
      expect(job.attrs.failReason).to.be('Undefined job');
    });

    it('updates nextRunAt', async () => {
      const now = new Date();
      job.repeatEvery('10 minutes');
      await delay(5);
      await job.run();
      expect(job.attrs.nextRunAt.valueOf()).to.be.greaterThan(now.valueOf() + 59999);
    });

    it('handles errors', async () => {
      job.attrs.name = 'failBoat';
      agenda.define('failBoat', () => {
        throw new Error('Zomg fail');
      });
      job.run().catch(err => {
        expect(err.message).to.be('Zomg fail');
      });
    });

    it('handles errors with q promises', () => {
      job.attrs.name = 'failBoat2';
      agenda.define('failBoat2', (job, cb) => {
        Q.delay(100).then(() => {
          throw new Error('Zomg fail');
        }).fail(cb).done();
      });
      job.run().catch(err => {
        expect(err).to.be.ok();
      });
    });

    it(`doesn't allow a stale job to be saved`, async () => {
      job.attrs.name = 'failBoat3';
      await job.save();
      agenda.define('failBoat3', async (job, cb) => {
        // Explicitly find the job again,
        // so we have a new job object
        const jobs = await agenda.jobs({name: 'failBoat3'});
        expect(jobs).to.have.length(1);
        await jobs[0].remove();
        cb();
      });

      await job.run();

      // Expect the deleted job to not exist in the database
      const deletedJob = await agenda.jobs({name: 'failBoat3'});
      expect(deletedJob).to.have.length(0);
    });
  });

  describe('touch', () => {
    it('extends the lock lifetime', done => {
      const lockedAt = new Date();
      const job = new Job({agenda, name: 'some job', lockedAt});
      job.save = function(cb) {
        cb();
      };
      setTimeout(() => {
        job.touch(() => {
          expect(job.attrs.lockedAt).to.be.greaterThan(lockedAt);
          done();
        });
      }, 2);
    });
  });

  describe('fail', () => {
    const job = new Job();
    it('takes a string', () => {
      job.fail('test');
      expect(job.attrs.failReason).to.be('test');
    });
    it('takes an error object', () => {
      job.fail(new Error('test'));
      expect(job.attrs.failReason).to.be('test');
    });
    it('sets the failedAt time', () => {
      job.fail('test');
      expect(job.attrs.failedAt).to.be.a(Date);
    });
    it('sets the failedAt time equal to lastFinishedAt time', () => {
      job.fail('test');
      expect(job.attrs.failedAt).to.be.equal(job.attrs.lastFinishedAt);
    });
  });

  describe('enable', () => {
    it('sets disabled to false on the job', () => {
      const job = new Job({disabled: true});
      job.enable();
      expect(job.attrs.disabled).to.be(false);
    });

    it('returns the job', () => {
      const job = new Job({disabled: true});
      expect(job.enable()).to.be(job);
    });
  });

  describe('disable', () => {
    it('sets disabled to true on the job', () => {
      const job = new Job();
      job.disable();
      expect(job.attrs.disabled).to.be(true);
    });
    it('returns the job', () => {
      const job = new Job();
      expect(job.disable()).to.be(job);
    });
  });

  describe('save', () => {
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
    });

    it('doesnt save the job if its been removed', async () => {
      const job = agenda.create('another job');
      // Save, then remove, then try and save again.
      // The second save should fail.
      const j = await job.save();
      await j.remove();
      await j.save();

      agenda.jobs({name: 'another job'}, (err, res) => {
        if (err) {
          throw err;
        }
        expect(res).to.have.length(0);
      });
    });

    it('returns the job', async () => {
      const job = agenda.create('some job', {
        wee: 1
      });
      expect(await job.save()).to.be(job);
    });
  });

  describe('start/stop', () => {
    it('starts/stops the job queue', done => {
      agenda.define('jobQueueTest', async (job, cb) => {
        await agenda.stop();
        await clearJobs();
        cb();
        agenda.define('jobQueueTest', (job, cb) => { // eslint-disable-line max-nested-callbacks
          cb();
        });
        done();
      });
      agenda.every('1 second', 'jobQueueTest');
      agenda.processEvery('1 second');
      agenda.start().then(() => {});
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

      expect(ran).to.be(false);

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
      agenda.define('longRunningJob', () => {
        // Job never finishes
      });
      agenda.every('10 seconds', 'longRunningJob');
      agenda.processEvery('1 second');

      await agenda.start();
      await delay(jobTimeout);
      await agenda.stop();

      agenda._collection.findOne({name: 'longRunningJob'}, (err, job) => {
        if (err) {
          throw err;
        }
        expect(job.lockedAt).to.be(null);
      });
    });

    describe('events', () => {
      beforeEach(() => {
        agenda.define('jobQueueTest', (job, cb) => {
          cb();
        });
        agenda.define('failBoat', () => {
          throw new Error('Zomg fail');
        });
      });

      it('emits start event', async () => {
        const spy = sinon.spy();
        const job = new Job({agenda, name: 'jobQueueTest'});
        agenda.once('start', spy);

        await job.run();
        expect(spy.called).to.be(true);
        expect(spy.calledWithExactly(job)).to.be(true);
      });

      it('emits start:job name event', async () => {
        const spy = sinon.spy();
        const job = new Job({agenda, name: 'jobQueueTest'});
        agenda.once('start:jobQueueTest', spy);

        await job.run();
        expect(spy.called).to.be(true);
        expect(spy.calledWithExactly(job)).to.be(true);
      });

      it('emits complete event', async () => {
        const spy = sinon.spy();
        const job = new Job({agenda, name: 'jobQueueTest'});
        agenda.once('complete', spy);

        await job.run();
        expect(spy.called).to.be(true);
        expect(spy.calledWithExactly(job)).to.be(true);
      });

      it('emits complete:job name event', async () => {
        const spy = sinon.spy();
        const job = new Job({agenda, name: 'jobQueueTest'});
        agenda.once('complete:jobQueueTest', spy);

        await job.run();
        expect(spy.called).to.be(true);
        expect(spy.calledWithExactly(job)).to.be(true);
      });

      it('emits success event', async () => {
        const spy = sinon.spy();
        const job = new Job({agenda, name: 'jobQueueTest'});
        agenda.once('success', spy);

        await job.run();
        expect(spy.called).to.be(true);
        expect(spy.calledWithExactly(job)).to.be(true);
      });

      it('emits success:job name event', async () => {
        const spy = sinon.spy();
        const job = new Job({agenda, name: 'jobQueueTest'});
        agenda.once('success:jobQueueTest', spy);

        await job.run();
        expect(spy.called).to.be(true);
        expect(spy.calledWithExactly(job)).to.be(true);
      });

      it('emits fail event', async () => {
        const spy = sinon.spy();
        const job = new Job({agenda, name: 'failBoat'});
        agenda.once('fail', spy);

        await job.run().catch(err => {
          expect(err.message).to.be('Zomg fail');
        });

        expect(spy.called).to.be(true);

        const err = spy.args[0][0];
        expect(err.message).to.be('Zomg fail');
        expect(job.attrs.failCount).to.be(1);
        expect(job.attrs.failedAt.valueOf()).not.to.be.below(job.attrs.lastFinishedAt.valueOf());
      });

      it('emits fail:job name event', async () => {
        const spy = sinon.spy();
        const job = new Job({agenda, name: 'failBoat'});
        agenda.once('fail:failBoat', spy);

        await job.run().catch(err => {
          expect(err.message).to.be('Zomg fail');
        });

        expect(spy.called).to.be(true);

        const err = spy.args[0][0];
        expect(err.message).to.be('Zomg fail');
        expect(job.attrs.failCount).to.be(1);
        expect(job.attrs.failedAt.valueOf()).not.to.be.below(job.attrs.lastFinishedAt.valueOf());
      });
    });
  });

  describe('job lock', () => {
    it('runs a recurring job after a lock has expired', done => {
      let startCounter = 0;

      agenda.define('lock job', {
        lockLifetime: 50
      }, () => {
        startCounter++;

        if (startCounter !== 1) {
          expect(startCounter).to.be(2);
          agenda.stop().then(() => {});
          done();
        }
      });

      expect(agenda._definitions['lock job'].lockLifetime).to.be(50);

      agenda.defaultConcurrency(100);
      agenda.processEvery(10);
      agenda.every('0.02 seconds', 'lock job');
      agenda.stop().then(() => {});
      agenda.start().then(() => {});
    });

    it('runs a one-time job after its lock expires', done => {
      let runCount = 0;

      agenda.define('lock job', {
        lockLifetime: 50
      }, (job, cb) => { // eslint-disable-line no-unused-vars
        runCount++;

        if (runCount !== 1) {
          expect(runCount).to.be(2);
          agenda.stop().then(() => {});
          done();
        }
      });

      agenda.processEvery(50);
      agenda.start().then(() => {});
      agenda.now('lock job', {
        i: 1
      });
    });

    it('does not process locked jobs', done => {
      const history = [];

      agenda.define('lock job', {
        lockLifetime: 300
      }, (job, cb) => {
        history.push(job.attrs.data.i);

        setTimeout(() => {
          cb();
        }, 150);
      });

      agenda.start().then(() => {});

      agenda.now('lock job', {i: 1});
      agenda.now('lock job', {i: 2});
      agenda.now('lock job', {i: 3});

      setTimeout(() => {
        expect(history).to.have.length(3);
        expect(history).to.contain(1);
        expect(history).to.contain(2);
        expect(history).to.contain(3);
        done();
      }, 500);
    });

    it('does not on-the-fly lock more than agenda._lockLimit jobs', done => {
      agenda.lockLimit(1);

      agenda.define('lock job', (job, cb) => {}); // eslint-disable-line no-unused-vars

      agenda.start().then(() => {});

      setTimeout(() => {
        agenda.now('lock job', {i: 1});
        agenda.now('lock job', {i: 2});

        setTimeout(() => {
          expect(agenda._lockedJobs).to.have.length(1);
          agenda.stop().then(() => {});
          done();
        }, 500);
      }, 500);
    });

    it('does not on-the-fly lock more than definition.lockLimit jobs', done => {
      agenda.define('lock job', {lockLimit: 1}, (job, cb) => {}); // eslint-disable-line no-unused-vars

      agenda.start().then(() => {});

      setTimeout(() => {
        agenda.now('lock job', {i: 1});
        agenda.now('lock job', {i: 2});

        setTimeout(() => {
          expect(agenda._lockedJobs).to.have.length(1);
          agenda.stop().then(() => {});
          done();
        }, 500);
      }, 500);
    });

    it('does not lock more than agenda._lockLimit jobs during processing interval', done => {
      agenda.lockLimit(1);
      agenda.processEvery(200);

      agenda.define('lock job', (job, cb) => {}); // eslint-disable-line no-unused-vars

      agenda.start().then(() => {});

      const when = moment().add(300, 'ms').toDate();

      agenda.schedule(when, 'lock job', {i: 1});
      agenda.schedule(when, 'lock job', {i: 2});

      setTimeout(() => {
        expect(agenda._lockedJobs).to.have.length(1);
        agenda.stop().then(() => {});
        done();
      }, 500);
    });

    it('does not lock more than definition.lockLimit jobs during processing interval', done => {
      agenda.processEvery(200);

      agenda.define('lock job', {lockLimit: 1}, (job, cb) => {}); // eslint-disable-line no-unused-vars

      agenda.start().then(() => {});

      const when = moment().add(300, 'ms').toDate();

      agenda.schedule(when, 'lock job', {i: 1});
      agenda.schedule(when, 'lock job', {i: 2});

      setTimeout(() => {
        expect(agenda._lockedJobs).to.have.length(1);
        agenda.stop().then(() => {});
        done();
      }, 500);
    });
  });

  describe.skip('job concurrency', () => {
    it('should not block a job for concurrency of another job', done => {
      agenda.processEvery(50);

      const processed = [];
      const now = Date.now();

      agenda.define('blocking', {
        concurrency: 1
      }, (job, cb) => {
        processed.push(job.attrs.data.i);
        setTimeout(cb, 400);
      });

      agenda.define('non-blocking', {
        // Lower priority to keep it at the back in the queue
        priority: 'lowest'
      }, job => {
        processed.push(job.attrs.data.i);
        expect(processed).not.to.contain(2);
      });

      let finished = false;
      agenda.on('complete', () => {
        if (!finished && processed.length === 3) {
          finished = true;
          done();
        }
      });

      agenda.start().then(() => {});

      agenda.schedule(new Date(now + 100), 'blocking', {i: 1}).then(() => {});
      agenda.schedule(new Date(now + 100), 'blocking', {i: 2}).then(() => {});
      agenda.schedule(new Date(now + 100), 'non-blocking', {i: 3}).then(() => {});
    });

    it('should run jobs as first in first out (FIFO)', done => {
      const results = [];

      agenda.define('fifo', {concurrency: 1}, (job, cb) => cb());

      const checkResults = job => {
        results.push(new Date(job.attrs.nextRunAt).getTime());
        if (results.length !== 3) {
          return;
        }
        expect(results.join('')).to.eql(results.sort().join(''));
        done();
      };

      agenda.on('start:fifo', checkResults);

      agenda.now('fifo', err => {
        if (err) {
          return done(err);
        }
        setTimeout(() => {
          agenda.now('fifo', err => {
            if (err) {
              return done(err);
            }
            setTimeout(() => { // eslint-disable-line max-nested-callbacks
              agenda.now('fifo', async err => { // eslint-disable-line max-nested-callbacks
                if (err) {
                  return done(err);
                }
                await agenda.start();
              });
            }, 50);
          });
        }, 50);
      });
    });

    it('should run jobs as first in first out (FIFO) with respect to priority', done => {
      const times = [];
      const priorities = [];
      const now = Date.now();

      agenda.define('fifo-priority', {concurrency: 1}, (job, cb) => cb());

      const checkResults = job => {
        priorities.push(job.attrs.priority);
        times.push(new Date(job.attrs.nextRunAt).getTime());
        if (priorities.length !== 3 || times.length !== 3) {
          return;
        }
        expect(times.join('')).to.eql(times.sort().join(''));
        expect(priorities).to.eql([10, 10, -10]);
        done();
      };

      agenda.on('start:fifo-priority', checkResults);

      agenda.create('fifo-priority').schedule(new Date(now)).priority('high').save(err => {
        if (err) {
          return done(err);
        }
        agenda.create('fifo-priority').schedule(new Date(now + 100)).priority('low').save(err => {
          if (err) {
            return done(err);
          }
          agenda.create('fifo-priority').schedule(new Date(now + 100)).priority('high').save(async err => {
            if (err) {
              return done(err);
            }
            await agenda.start();
          });
        });
      });
    });

    it('should run higher priority jobs first', done => {
      // Inspired by tests added by @lushc here:
      // <https://github.com/agenda/agenda/pull/451/commits/336ff6445803606a6dc468a6f26c637145790adc>
      const now = new Date();
      const results = [];

      agenda.define('priority', {concurrency: 1}, (job, cb) => cb());

      const checkResults = job => {
        results.push(job.attrs.priority);
        if (results.length !== 3) {
          return;
        }
        expect(results).to.eql([10, 0, -10]);
        done();
      };

      agenda.on('start:priority', checkResults);

      agenda.create('priority').schedule(now).save(err => {
        if (err) {
          return done(err);
        }
        agenda.create('priority').schedule(now).priority('low').save(err => {
          if (err) {
            return done(err);
          }
          agenda.create('priority').schedule(now).priority('high').save(err => {
            if (err) {
              return done(err);
            }
            agenda.start().then(() => {});
          });
        });
      });
    });

    it('should support custom sort option', () => {
      const sort = {foo: 1};
      const agenda = new Agenda({sort});
      expect(agenda._sort).to.eql(sort);
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

      agenda.every(10, 'everyRunTest1');

      await agenda.start();

      await delay(jobTimeout);
      await agenda.jobs({name: 'everyRunTest1'});
      expect(counter).to.be(2);

      await agenda.stop();
    });

    it('should reuse the same job on multiple runs', done => {
      let counter = 0;

      agenda.define('everyRunTest2', (job, cb) => {
        if (counter < 2) {
          counter++;
        }
        cb();
      });
      agenda.every(10, 'everyRunTest2');

      agenda.start().then(() => {});

      setTimeout(() => {
        agenda.jobs({name: 'everyRunTest2'}, (err, res) => {
          if (err) {
            done(err);
          }
          expect(res).to.have.length(1);
          agenda.stop().then(() => {});
          done();
        });
      }, jobTimeout);
    });
  });

  describe('Integration Tests', () => {
    describe('.every()', () => {
      it('Should not rerun completed jobs after restart', done => {
        let i = 0;

        const serviceError = function(e) {
          done(e);
        };
        const receiveMessage = function(msg) {
          if (msg === 'ran') {
            expect(i).to.be(0);
            i += 1;
            startService(); // eslint-disable-line no-use-before-define
          } else if (msg === 'notRan') {
            expect(i).to.be(1);
            done();
          } else {
            return done(new Error('Unexpected response returned!'));
          }
        };

        const startService = () => {
          const serverPath = path.join(__dirname, 'fixtures', 'agenda-instance.js');
          const n = cp.fork(serverPath, [mongoCfg, 'daily']);

          n.on('message', receiveMessage);
          n.on('error', serviceError);
        };

        startService();
      });

      it('Should properly run jobs when defined via an array', done => {
        const serverPath = path.join(__dirname, 'fixtures', 'agenda-instance.js');
        const n = cp.fork(serverPath, [mongoCfg, 'daily-array']);

        let ran1 = false;
        let ran2 = true;
        let doneCalled = false;

        const serviceError = function(e) {
          done(e);
        };
        const receiveMessage = function(msg) {
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
          } else {
            return done(new Error('Jobs did not run!'));
          }
        };

        n.on('message', receiveMessage);
        n.on('error', serviceError);
      });

      it('should not run if job is disabled', done => {
        let counter = 0;

        agenda.define('everyDisabledTest', (job, cb) => {
          counter++;
          cb();
        });

        const job = agenda.every(10, 'everyDisabledTest');

        job.disable();

        job.save(async () => {
          await agenda.start();

          setTimeout(() => {
            agenda.jobs({name: 'everyDisabledTest'}, err => {
              if (err) {
                return done(err);
              }
              expect(counter).to.be(0);
              agenda.stop().then(() => {});
              done();
            });
          }, jobTimeout);
        });
      });
    });

    describe('schedule()', () => {
      it('Should not run jobs scheduled in the future', done => {
        let i = 0;

        const serviceError = function(e) {
          done(e);
        };
        const receiveMessage = function(msg) {
          if (msg === 'notRan') {
            if (i < 5) {
              return done();
            }

            i += 1;
            startService(); // eslint-disable-line no-use-before-define
          } else {
            return done(new Error('Job scheduled in future was ran!'));
          }
        };

        const startService = () => {
          const serverPath = path.join(__dirname, 'fixtures', 'agenda-instance.js');
          const n = cp.fork(serverPath, [mongoCfg, 'define-future-job']);

          n.on('message', receiveMessage);
          n.on('error', serviceError);
        };

        startService();
      });

      it('Should run past due jobs when process starts', done => {
        const serviceError = function(e) {
          done(e);
        };
        const receiveMessage = function(msg) {
          if (msg === 'ran') {
            done();
          } else {
            return done(new Error('Past due job did not run!'));
          }
        };

        const startService = () => {
          const serverPath = path.join(__dirname, 'fixtures', 'agenda-instance.js');
          const n = cp.fork(serverPath, [mongoCfg, 'define-past-due-job']);

          n.on('message', receiveMessage);
          n.on('error', serviceError);
        };

        startService();
      });

      it('Should schedule using array of names', done => {
        const serverPath = path.join(__dirname, 'fixtures', 'agenda-instance.js');
        const n = cp.fork(serverPath, [mongoCfg, 'schedule-array']);

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
          } else {
            return done(new Error('Jobs did not run!'));
          }
        };

        n.on('message', receiveMessage);
        n.on('error', serviceError);
      });
    });

    describe('now()', () => {
      it('Should immediately run the job', done => {
        const serviceError = function(e) {
          done(e);
        };
        const receiveMessage = function(msg) {
          if (msg === 'ran') {
            return done();
          }
          return done(new Error('Job did not immediately run!'));
        };

        const serverPath = path.join(__dirname, 'fixtures', 'agenda-instance.js');
        const n = cp.fork(serverPath, [mongoCfg, 'now']);

        n.on('message', receiveMessage);
        n.on('error', serviceError);
      });
    });

    describe('General Integration', () => {
      it('Should not run a job that has already been run', done => {
        const runCount = {};

        agenda.define('test-job', (job, cb) => {
          const id = job.attrs._id.toString();
          runCount[id] = runCount[id] ? runCount[id] + 1 : 1;
          cb();
        });

        agenda.start();

        for (let i = 0; i < 10; i++) {
          agenda.now('test-job');
        }

        setTimeout(() => {
          const ids = Object.keys(runCount);
          expect(ids).to.have.length(10);
          Object.keys(runCount).forEach(id => {
            expect(runCount[id]).to.be(1);
          });
          done();
        }, jobTimeout);
      });
    });
  });
});
