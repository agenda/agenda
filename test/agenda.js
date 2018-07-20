/* globals describe, it, beforeEach, afterEach */
'use strict';
const expect = require('expect.js');
const {MongoClient} = require('mongodb');
const delay = require('delay');
const Agenda = require('..');
const Job = require('../lib/job');

const mongoHost = process.env.MONGODB_HOST || 'localhost';
const mongoPort = process.env.MONGODB_PORT || '27017';
const agendaDatabase = 'agenda-test';
const mongoCfg = 'mongodb://' + mongoHost + ':' + mongoPort + '/' + agendaDatabase;

// Create agenda instances
let jobs = null;
let mongoDb = null;
let mongoClient = null;

const clearJobs = () => {
  return mongoDb.collection('agendaJobs').deleteMany({});
};

// Slow timeouts for Travis
const jobTimeout = process.env.TRAVIS ? 2500 : 500;
const jobType = 'do work';
const jobProcessor = () => {};

describe('Agenda', () => {
  beforeEach(() => {
    return new Promise(async resolve => {
      jobs = new Agenda({
        db: {
          address: mongoCfg
        }
      }, () => {
        MongoClient.connect(mongoCfg, async(err, client) => {
          if (err) {
            throw err;
          }
          mongoClient = client;
          mongoDb = client.db(agendaDatabase);
          await delay(50);
          await clearJobs();
          jobs.define('someJob', jobProcessor);
          jobs.define('send email', jobProcessor);
          jobs.define('some job', jobProcessor);
          jobs.define(jobType, jobProcessor);
          return resolve();
        });
      });
    });
  });

  afterEach(() => {
    return new Promise(async resolve => {
      await delay(50);
      await jobs.stop();
      await clearJobs();
      await mongoClient.close();
      await jobs._db.close();
      return resolve();
    });
  });

  it('sets a default processEvery', () => {
    expect(jobs._processEvery).to.be(5000);
  });

  describe('configuration methods', () => {
    it('sets the _db directly when passed as an option', () => {
      const agenda = new Agenda({mongo: mongoDb});
      expect(agenda._mdb.databaseName).to.equal(agendaDatabase);
    });
  });

  describe('configuration methods', () => {
    describe('mongo', () => {
      it('sets the _db directly', () => {
        const agenda = new Agenda();
        agenda.mongo(mongoDb);
        expect(agenda._mdb.databaseName).to.equal(agendaDatabase);
      });

      it('returns itself', () => {
        const agenda = new Agenda();
        expect(agenda.mongo(mongoDb)).to.be(agenda);
      });
    });

    describe('name', () => {
      it('sets the agenda name', () => {
        jobs.name('test queue');
        expect(jobs._name).to.be('test queue');
      });
      it('returns itself', () => {
        expect(jobs.name('test queue')).to.be(jobs);
      });
    });

    describe('processEvery', () => {
      it('sets the processEvery time', () => {
        jobs.processEvery('3 minutes');
        expect(jobs._processEvery).to.be(180000);
      });
      it('returns itself', () => {
        expect(jobs.processEvery('3 minutes')).to.be(jobs);
      });
    });
    describe('maxConcurrency', () => {
      it('sets the maxConcurrency', () => {
        jobs.maxConcurrency(10);
        expect(jobs._maxConcurrency).to.be(10);
      });
      it('returns itself', () => {
        expect(jobs.maxConcurrency(10)).to.be(jobs);
      });
    });
    describe('defaultConcurrency', () => {
      it('sets the defaultConcurrency', () => {
        jobs.defaultConcurrency(1);
        expect(jobs._defaultConcurrency).to.be(1);
      });
      it('returns itself', () => {
        expect(jobs.defaultConcurrency(5)).to.be(jobs);
      });
    });
    describe('lockLimit', () => {
      it('sets the lockLimit', () => {
        jobs.lockLimit(10);
        expect(jobs._lockLimit).to.be(10);
      });
      it('returns itself', () => {
        expect(jobs.lockLimit(10)).to.be(jobs);
      });
    });
    describe('defaultLockLimit', () => {
      it('sets the defaultLockLimit', () => {
        jobs.defaultLockLimit(1);
        expect(jobs._defaultLockLimit).to.be(1);
      });
      it('returns itself', () => {
        expect(jobs.defaultLockLimit(5)).to.be(jobs);
      });
    });
    describe('defaultLockLifetime', () => {
      it('returns itself', () => {
        expect(jobs.defaultLockLifetime(1000)).to.be(jobs);
      });
      it('sets the default lock lifetime', () => {
        jobs.defaultLockLifetime(9999);
        expect(jobs._defaultLockLifetime).to.be(9999);
      });
      it('is inherited by jobs', () => {
        jobs.defaultLockLifetime(7777);
        jobs.define('testDefaultLockLifetime', () => {});
        expect(jobs._definitions.testDefaultLockLifetime.lockLifetime).to.be(7777);
      });
    });
    describe('sort', () => {
      it('returns itself', () => {
        expect(jobs.sort({nextRunAt: 1, priority: -1})).to.be(jobs);
      });
      it('sets the default sort option', () => {
        jobs.sort({nextRunAt: -1});
        expect(jobs._sort).to.eql({nextRunAt: -1});
      });
    });
  });

  describe('job methods', () => {
    describe('create', () => {
      let job;
      beforeEach(() => {
        job = jobs.create('sendEmail', {to: 'some guy'});
      });

      it('returns a job', () => {
        expect(job).to.be.a(Job);
      });
      it('sets the name', () => {
        expect(job.attrs.name).to.be('sendEmail');
      });
      it('sets the type', () => {
        expect(job.attrs.type).to.be('normal');
      });
      it('sets the agenda', () => {
        expect(job.agenda).to.be(jobs);
      });
      it('sets the data', () => {
        expect(job.attrs.data).to.have.property('to', 'some guy');
      });
    });

    describe('define', () => {
      it('stores the definition for the job', () => {
        expect(jobs._definitions.someJob).to.have.property('fn', jobProcessor);
      });

      it('sets the default concurrency for the job', () => {
        expect(jobs._definitions.someJob).to.have.property('concurrency', 5);
      });

      it('sets the default lockLimit for the job', () => {
        expect(jobs._definitions.someJob).to.have.property('lockLimit', 0);
      });

      it('sets the default priority for the job', () => {
        expect(jobs._definitions.someJob).to.have.property('priority', 0);
      });
      it('takes concurrency option for the job', () => {
        jobs.define('highPriority', {priority: 10}, jobProcessor);
        expect(jobs._definitions.highPriority).to.have.property('priority', 10);
      });
    });

    describe('every', () => {
      describe('with a job name specified', () => {
        it('returns a job', async() => {
          expect(await jobs.every('5 minutes', 'send email')).to.be.a(Job);
        });
        it('sets the repeatEvery', async() => {
          expect(await jobs.every('5 seconds', 'send email').then(({attrs}) => attrs.repeatInterval)).to.be('5 seconds');
        });
        it('sets the agenda', async() => {
          expect(await jobs.every('5 seconds', 'send email').then(({agenda}) => agenda)).to.be(jobs);
        });
        it('should update a job that was previously scheduled with `every`', async() => {
          await jobs.every(10, 'shouldBeSingleJob');
          await delay(10);
          await jobs.every(20, 'shouldBeSingleJob');

          // Give the saves a little time to propagate
          await delay(jobTimeout);

          const res = await jobs.jobs({name: 'shouldBeSingleJob'});
          expect(res).to.have.length(1);
        });
      });
      describe('with array of names specified', () => {
        it('returns array of jobs', async() => {
          expect(await jobs.every('5 minutes', ['send email', 'some job'])).to.be.an('array');
        });
      });
    });

    describe('schedule', () => {
      describe('with a job name specified', () => {
        it('returns a job', async() => {
          expect(await jobs.schedule('in 5 minutes', 'send email')).to.be.a(Job);
        });
        it('sets the schedule', async() => {
          const fiveish = (new Date()).valueOf() + 250000;
          const scheduledJob = await jobs.schedule('in 5 minutes', 'send email');
          expect(scheduledJob.attrs.nextRunAt.valueOf()).to.be.greaterThan(fiveish);
        });
      });
      describe('with array of names specified', () => {
        it('returns array of jobs', async() => {
          expect(await jobs.schedule('5 minutes', ['send email', 'some job'])).to.be.an('array');
        });
      });
    });

    describe('unique', () => {
      describe('should demonstrate unique contraint', () => {
        it('should modify one job when unique matches', async() => {
          const job1 = await jobs.create('unique job', {
            type: 'active',
            userId: '123',
            other: true
          }).unique({
            'data.type': 'active',
            'data.userId': '123'
          }).schedule('now').save();

          const job2 = await jobs.create('unique job', {
            type: 'active',
            userId: '123',
            other: false
          }).unique({
            'data.type': 'active',
            'data.userId': '123'
          }).schedule('now').save();

          expect(job1.attrs.nextRunAt.toISOString()).not.to.equal(job2.attrs.nextRunAt.toISOString());

          mongoDb.collection('agendaJobs').find({
            name: 'unique job'
          }).toArray((err, jobs) => {
            if (err) {
              throw err;
            }

            expect(jobs).to.have.length(1);
          });
        });

        it('should not modify job when unique matches and insertOnly is set to true', async() => {
          const job1 = await jobs.create('unique job', {
            type: 'active',
            userId: '123',
            other: true
          }).unique({
            'data.type': 'active',
            'data.userId': '123'
          }, {
            insertOnly: true
          }).schedule('now').save();

          const job2 = await jobs.create('unique job', {
            type: 'active',
            userId: '123',
            other: false
          }).unique({
            'data.type': 'active',
            'data.userId': '123'
          }, {
            insertOnly: true
          }).schedule('now').save();

          expect(job1.attrs.nextRunAt.toISOString()).to.equal(job2.attrs.nextRunAt.toISOString());

          mongoDb.collection('agendaJobs').find({
            name: 'unique job'
          }).toArray((err, jobs) => {
            if (err) {
              throw err;
            }
            expect(jobs).to.have.length(1);
          });
        });
      });

      describe('should demonstrate non-unique contraint', () => {
        it(`should create two jobs when unique doesn't match`, async() => {
          const time = new Date(Date.now() + (1000 * 60 * 3));
          const time2 = new Date(Date.now() + (1000 * 60 * 4));

          await jobs.create('unique job', {
            type: 'active',
            userId: '123',
            other: true
          }).unique({
            'data.type': 'active',
            'data.userId': '123',
            nextRunAt: time
          }).schedule(time).save();

          await jobs.create('unique job', {
            type: 'active',
            userId: '123',
            other: false
          }).unique({
            'data.type': 'active',
            'data.userId': '123',
            nextRunAt: time2
          }).schedule(time).save();

          mongoDb.collection('agendaJobs').find({
            name: 'unique job'
          }).toArray((err, jobs) => {
            if (err) {
              throw err;
            }
            expect(jobs).to.have.length(2);
          });
        });
      });
    });

    describe('now', () => {
      it('returns a job', async() => {
        expect(await jobs.now('send email')).to.be.a(Job);
      });
      it('sets the schedule', async() => {
        const now = new Date();
        expect(await jobs.now('send email').then(({attrs}) => attrs.nextRunAt.valueOf())).to.be.greaterThan(now.valueOf() - 1);
      });

      it('runs the job immediately', async() => {
        jobs.define('immediateJob', async job => {
          expect(job.isRunning()).to.be(true);
          await jobs.stop();
        });
        await jobs.now('immediateJob');
        await jobs.start();
      });
    });

    describe('jobs', () => {
      it('returns jobs', async() => {
        await jobs.create('test').save();
        jobs.jobs({}, async(err, c) => {
          if (err) {
            throw err;
          }
          expect(c.length).to.not.be(0);
          expect(c[0]).to.be.a(Job);
          await clearJobs();
        });
      });
    });

    describe('purge', () => {
      it('removes all jobs without definitions', async() => {
        const job = jobs.create('no definition');
        await jobs.stop();
        await job.save();
        jobs.jobs({
          name: 'no definition'
        }, async(err, j) => { // eslint-disable-line max-nested-callbacks
          if (err) {
            throw err;
          }
          expect(j).to.have.length(1);
          await jobs.purge();
          jobs.jobs({
            name: 'no definition'
          }, (err, j) => { // eslint-disable-line max-nested-callbacks
            if (err) {
              throw err;
            }
            expect(j).to.have.length(0);
          });
        });
      });
    });

    describe('saveJob', () => {
      it('persists job to the database', async() => {
        const job = jobs.create('someJob', {});
        await job.save();

        expect(job.attrs._id).to.be.ok();

        await clearJobs();
      });
    });
  });

  describe('cancel', () => {
    beforeEach(async() => {
      let remaining = 3;
      const checkDone = () => {
        remaining--;
      };
      await jobs.create('jobA').save().then(checkDone);
      await jobs.create('jobA', 'someData').save().then(checkDone);
      await jobs.create('jobB').save().then(checkDone);
      expect(remaining).to.be(0);
    });

    afterEach(done => {
      jobs._collection.remove({name: {$in: ['jobA', 'jobB']}}, err => {
        if (err) {
          return done(err);
        }
        done();
      });
    });

    it('should cancel a job', async() => {
      const j = await jobs.jobs({name: 'jobA'});
      expect(j).to.have.length(2);

      await jobs.cancel({name: 'jobA'});
      const job = await jobs.jobs({name: 'jobA'});

      expect(job).to.have.length(0);
    });

    it('should cancel multiple jobs', async() => {
      const jobs1 = await jobs.jobs({name: {$in: ['jobA', 'jobB']}});
      expect(jobs1).to.have.length(3);
      await jobs.cancel({name: {$in: ['jobA', 'jobB']}});

      const jobs2 = await jobs.jobs({name: {$in: ['jobA', 'jobB']}});
      expect(jobs2).to.have.length(0);
    });

    it('should cancel jobs only if the data matches', async() => {
      const jobs1 = await jobs.jobs({name: 'jobA', data: 'someData'});
      expect(jobs1).to.have.length(1);
      await jobs.cancel({name: 'jobA', data: 'someData'});

      const jobs2 = await jobs.jobs({name: 'jobA', data: 'someData'});
      expect(jobs2).to.have.length(0);

      const jobs3 = await jobs.jobs({name: 'jobA'});
      expect(jobs3).to.have.length(1);
    });
  });
});
