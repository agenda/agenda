/* globals describe, it, beforeEach, afterEach */
'use strict';
const path = require('path');
const cp = require('child_process');
const expect = require('expect.js');
const moment = require('moment-timezone');
const MongoClient = require('mongodb').MongoClient;
const Q = require('q');
const Agenda = require('../index');
const Job = require('../lib/job');

const mongoHost = process.env.MONGODB_HOST || 'localhost';
const mongoPort = process.env.MONGODB_PORT || '27017';
const mongoCfg = 'mongodb://' + mongoHost + ':' + mongoPort + '/agenda-test';

// Create agenda instances
let jobs = null;
let mongo = null;

const clearJobs = done => {
  mongo.collection('agendaJobs').remove({}, done);
};

// Slow timeouts for Travis
const jobTimeout = process.env.TRAVIS ? 3500 : 500;
const jobType = 'do work';
const jobProcessor = () => {};

describe('Job', () => {
  beforeEach(done => {
    jobs = new Agenda({
      db: {
        address: mongoCfg
      }
    }, err => {
      MongoClient.connect(mongoCfg, (err, db) => {
        mongo = db;
        setTimeout(() => {
          clearJobs(() => {
            jobs.define('someJob', jobProcessor);
            jobs.define('send email', jobProcessor);
            jobs.define('some job', jobProcessor);
            jobs.define(jobType, jobProcessor);
            done();
          });
        }, 50);
      });
    });
  });

  afterEach(done => {
    setTimeout(() => {
      jobs.stop(() => {
        clearJobs(() => {
          mongo.close(() => {
            jobs._mdb.close(done);
          });
        });
      });
    }, 50);
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
        agenda: jobs,
        name: 'removed job'
      });
      job.save(err => {
        if (err) {
          return done(err);
        }
        job.remove(err => {
          if (err) {
            return done(err);
          }
          mongo.collection('agendaJobs').find({
            _id: job.attrs._id
          }).toArray((err, j) => {
            expect(j).to.have.length(0);
            done();
          });
        });
      });
    });
  });

  describe('run', () => {
    let job;

    beforeEach(() => {
      jobs.define('testRun', (job, done) => {
        setTimeout(() => {
          done();
        }, 100);
      });

      job = new Job({agenda: jobs, name: 'testRun'});
    });

    it('updates lastRunAt', done => {
      const now = new Date();
      setTimeout(() => {
        job.run(() => {
          expect(job.attrs.lastRunAt.valueOf()).to.be.greaterThan(now.valueOf());
          done();
        });
      }, 5);
    });

    it('fails if job is undefined', done => {
      job = new Job({agenda: jobs, name: 'not defined'});
      job.run(() => {
        expect(job.attrs.failedAt).to.be.ok();
        expect(job.attrs.failReason).to.be('Undefined job');
        done();
      });
    });
    it('updates nextRunAt', done => {
      const now = new Date();
      job.repeatEvery('10 minutes');
      setTimeout(() => {
        job.run(() => {
          expect(job.attrs.nextRunAt.valueOf()).to.be.greaterThan(now.valueOf() + 59999);
          done();
        });
      }, 5);
    });
    it('handles errors', done => {
      job.attrs.name = 'failBoat';
      jobs.define('failBoat', (job, cb) => {
        throw new Error('Zomg fail');
      });
      job.run(err => {
        expect(err).to.be.ok();
        done();
      });
    });
    it('handles errors with q promises', done => {
      job.attrs.name = 'failBoat2';
      jobs.define('failBoat2', (job, cb) => {
        Q.delay(100).then(() => {
          throw new Error('Zomg fail');
        }).fail(cb).done();
      });
      job.run(err => {
        expect(err).to.be.ok();
        done();
      });
    });

    it(`doesn't allow a stale job to be saved`, done => {
      job.attrs.name = 'failBoat3';
      job.save(err => {
        if (err) {
          return done(err);
        }
        jobs.define('failBoat3', (job, cb) => {
          // Explicitly find the job again,
          // so we have a new job object
          jobs.jobs({name: 'failBoat3'}, (err, j) => {
            if (err) {
              return done(err);
            }
            j[0].remove(err => {
              if (err) {
                return done(err);
              }
              cb();
            });
          });
        });

        job.run(err => {
          // Expect the deleted job to not exist in the database
          jobs.jobs({name: 'failBoat3'}, (err, j) => {
            if (err) {
              return done(err);
            }
            expect(j).to.have.length(0);
            done();
          });
        });
      });
    });
  });

  describe('touch', () => {
    it('extends the lock lifetime', done => {
      const lockedAt = new Date();
      const job = new Job({agenda: jobs, name: 'some job', lockedAt});
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
      const oldSaveJob = jobs.saveJob;
      jobs.saveJob = () => {
        jobs.saveJob = oldSaveJob;
        done();
      };
      const job = jobs.create('some job', {
        wee: 1
      });
      job.save();
    });

    it('doesnt save the job if its been removed', done => {
      const job = jobs.create('another job');
      // Save, then remove, then try and save again.
      // The second save should fail.
      job.save((err, j) => {
        j.remove(() => {
          j.save((err, res) => {
            jobs.jobs({name: 'another job'}, function(err, res) {
              expect(res).to.have.length(0);
              done();
            });
          });
        });
      });
    });

    it('returns the job', () => {
      const job = jobs.create('some job', {
        wee: 1
      });
      expect(job.save()).to.be(job);
    });
  });

  describe('start/stop', () => {
    it('starts/stops the job queue', done => {
      jobs.define('jobQueueTest', (job, cb) => {
        jobs.stop(() => {
          clearJobs(() => {
            cb();
            jobs.define('jobQueueTest', (job, cb) => {
              cb();
            });
            done();
          });
        });
      });
      jobs.every('1 second', 'jobQueueTest');
      jobs.processEvery('1 second');
      jobs.start();
    });

    it('does not run disabled jobs', done => {
      let ran = false;
      jobs.define('disabledJob', () => {
        ran = true;
      });
      const job = jobs.create('disabledJob').disable().schedule('now');
      job.save(err => {
        if (err) {
          return done(err);
        }
        jobs.start();
        setTimeout(() => {
          expect(ran).to.be(false);
          jobs.stop(done);
        }, jobTimeout);
      });
    });

    it('does not throw an error trying to process undefined jobs', done => {
      jobs.start();
      const job = jobs.create('jobDefinedOnAnotherServer').schedule('now');

      job.save(err => {
        expect(err).to.be(null);
      });

      setTimeout(() => {
        jobs.stop(done);
      }, jobTimeout);
    });

    it('clears locks on stop', done => {
      jobs.define('longRunningJob', (job, cb) => {
        // Job never finishes
      });
      jobs.every('10 seconds', 'longRunningJob');
      jobs.processEvery('1 second');
      jobs.start();
      setTimeout(() => {
        jobs.stop(err => {
          jobs._collection.findOne({name: 'longRunningJob'}, (err, job) => {
            expect(job.lockedAt).to.be(null);
            done();
          });
        });
      }, jobTimeout);
    });

    describe('events', () => {
      beforeEach(() => {
        jobs.define('jobQueueTest', (job, cb) => {
          cb();
        });
        jobs.define('failBoat', (job, cb) => {
          throw new Error('Zomg fail');
        });
      });

      it('emits start event', done => {
        const job = new Job({agenda: jobs, name: 'jobQueueTest'});
        jobs.once('start', j => {
          expect(j).to.be(job);
          done();
        });
        job.run();
      });
      it('emits start:job name event', done => {
        const job = new Job({agenda: jobs, name: 'jobQueueTest'});
        jobs.once('start:jobQueueTest', j => {
          expect(j).to.be(job);
          done();
        });
        job.run();
      });
      it('emits complete event', done => {
        const job = new Job({agenda: jobs, name: 'jobQueueTest'});
        jobs.once('complete', j => {
          expect(job.attrs._id.toString()).to.be(j.attrs._id.toString());
          done();
        });
        job.run();
      });
      it('emits complete:job name event', done => {
        const job = new Job({agenda: jobs, name: 'jobQueueTest'});
        jobs.once('complete:jobQueueTest', j => {
          expect(job.attrs._id.toString()).to.be(j.attrs._id.toString());
          done();
        });
        job.run();
      });
      it('emits success event', done => {
        const job = new Job({agenda: jobs, name: 'jobQueueTest'});
        jobs.once('success', j => {
          expect(j).to.be.ok();
          done();
        });
        job.run();
      });
      it('emits success:job name event', done => {
        const job = new Job({agenda: jobs, name: 'jobQueueTest'});
        jobs.once('success:jobQueueTest', j => {
          expect(j).to.be.ok();
          done();
        });
        job.run();
      });
      it('emits fail event', done => {
        const job = new Job({agenda: jobs, name: 'failBoat'});
        jobs.once('fail', (err, j) => {
          expect(err.message).to.be('Zomg fail');
          expect(j).to.be(job);
          expect(j.attrs.failCount).to.be(1);
          expect(j.attrs.failedAt.valueOf()).not.to.be.below(j.attrs.lastFinishedAt.valueOf());

          jobs.once('fail', (err, j) => {
            expect(j).to.be(job);
            expect(j.attrs.failCount).to.be(2);
            done();
          });
          job.run();
        });
        job.run();
      });
      it('emits fail:job name event', done => {
        const job = new Job({agenda: jobs, name: 'failBoat'});
        jobs.once('fail:failBoat', (err, j) => {
          expect(err.message).to.be('Zomg fail');
          expect(j).to.be(job);
          done();
        });
        job.run();
      });
    });
  });

  describe('job lock', () => {
    it('runs a recurring job after a lock has expired', done => {
      let startCounter = 0;

      jobs.define('lock job', {
        lockLifetime: 50
      }, (job, cb) => {
        startCounter++;

        if (startCounter !== 1) {
          expect(startCounter).to.be(2);
          jobs.stop(done);
        }
      });

      expect(jobs._definitions['lock job'].lockLifetime).to.be(50);

      jobs.defaultConcurrency(100);
      jobs.processEvery(10);
      jobs.every('0.02 seconds', 'lock job');
      jobs.stop();
      jobs.start();
    });

    it('runs a one-time job after its lock expires', done => {
      let runCount = 0;

      jobs.define('lock job', {
        lockLifetime: 50
      }, (job, cb) => {
        runCount++;

        if (runCount !== 1) {
          expect(runCount).to.be(2);
          jobs.stop(done);
        }
      });

      jobs.processEvery(50);
      jobs.start();
      jobs.now('lock job', {
        i: 1
      });
    });

    it('does not process locked jobs', done => {
      const history = [];

      jobs.define('lock job', {
        lockLifetime: 300
      }, (job, cb) => {
        history.push(job.attrs.data.i);

        setTimeout(() => {
          cb();
        }, 150);
      });

      jobs.start();

      jobs.now('lock job', {i: 1});
      jobs.now('lock job', {i: 2});
      jobs.now('lock job', {i: 3});

      setTimeout(() => {
        expect(history).to.have.length(3);
        expect(history).to.contain(1);
        expect(history).to.contain(2);
        expect(history).to.contain(3);
        done();
      }, 500);
    });

    it('does not on-the-fly lock more than agenda._lockLimit jobs', done => {
      jobs.lockLimit(1);

      jobs.define('lock job', (job, cb) => {});

      jobs.start();

      setTimeout(() => {
        jobs.now('lock job', {i: 1});
        jobs.now('lock job', {i: 2});

        setTimeout(() => {
          expect(jobs._lockedJobs).to.have.length(1);
          jobs.stop(done);
        }, 500);
      }, 500);
    });

    it('does not on-the-fly lock more than definition.lockLimit jobs', done => {
      jobs.define('lock job', {
        lockLimit: 1
      }, (job, cb) => {});

      jobs.start();

      setTimeout(() => {
        jobs.now('lock job', {i: 1});
        jobs.now('lock job', {i: 2});

        setTimeout(() => {
          expect(jobs._lockedJobs).to.have.length(1);
          jobs.stop(done);
        }, 500);
      }, 500);
    });

    it('does not lock more than agenda._lockLimit jobs during processing interval', done => {
      jobs.lockLimit(1);
      jobs.processEvery(200);

      jobs.define('lock job', (job, cb) => {});

      jobs.start();

      const when = moment().add(300, 'ms').toDate();

      jobs.schedule(when, 'lock job', {i: 1});
      jobs.schedule(when, 'lock job', {i: 2});

      setTimeout(() => {
        expect(jobs._lockedJobs).to.have.length(1);
        jobs.stop(done);
      }, 500);
    });

    it('does not lock more than definition.lockLimit jobs during processing interval', done => {
      jobs.processEvery(200);

      jobs.define('lock job', {
        lockLimit: 1
      }, (job, cb) => {});

      jobs.start();

      const when = moment().add(300, 'ms').toDate();

      jobs.schedule(when, 'lock job', {i: 1});
      jobs.schedule(when, 'lock job', {i: 2});

      setTimeout(() => {
        expect(jobs._lockedJobs).to.have.length(1);
        jobs.stop(done);
      }, 500);
    });
  });

  describe('job concurrency', () => {
    it('should not block a job for concurrency of another job', done => {
      jobs.processEvery(50);

      const processed = [];
      const now = Date.now();

      jobs.define('blocking', {
        concurrency: 1
      }, (job, cb) => {
        processed.push(job.attrs.data.i);
        setTimeout(cb, 400);
      });

      jobs.define('non-blocking', {
        // Lower priority to keep it at the back in the queue
        priority: 'lowest'
      }, job => {
        processed.push(job.attrs.data.i);
        expect(processed).not.to.contain(2);
      });

      let finished = false;
      jobs.on('complete', job => {
        if (!finished && processed.length === 3) {
          finished = true;
          done();
        }
      });

      jobs.on('fail', (err, job) => {
        expect(err).to.be(undefined);
      });

      jobs.start();

      jobs.schedule(new Date(now + 100), 'blocking', {i: 1});

      setTimeout(() => {
        jobs.schedule(new Date(now + 100), 'blocking', {i: 2});
        jobs.schedule(new Date(now + 100), 'non-blocking', {i: 3});
      }, 100);
    });
  });

  describe('every running', () => {
    beforeEach(done => {
      jobs.defaultConcurrency(1);
      jobs.processEvery(5);

      jobs.stop(done);
    });

    it('should run the same job multiple times', done => {
      let counter = 0;

      jobs.define('everyRunTest1', (job, cb) => {
        if (counter < 2) {
          counter++;
        }
        cb();
      });

      jobs.every(10, 'everyRunTest1');

      jobs.start();

      setTimeout(() => {
        jobs.jobs({name: 'everyRunTest1'}, (err, res) => {
          expect(counter).to.be(2);
          jobs.stop(done);
        });
      }, jobTimeout);
    });

    it('should reuse the same job on multiple runs', done => {
      let counter = 0;

      jobs.define('everyRunTest2', (job, cb) => {
        if (counter < 2) {
          counter++;
        }
        cb();
      });
      jobs.every(10, 'everyRunTest2');

      jobs.start();

      setTimeout(() => {
        jobs.jobs({name: 'everyRunTest2'}, (err, res) => {
          expect(res).to.have.length(1);
          jobs.stop(done);
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
            startService();
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
        let ran1 = false;
        let ran2 = true;
        let doneCalled = false;

        const serviceError = function(e) {
          done(e);
        };
        const receiveMessage = function(msg) {
          if (msg === 'test1-ran') {
            ran1 = true;
            if (!!ran1 && !!ran2 && !doneCalled) {
              doneCalled = true;
              done();
              return n.send('exit');
            }
          } else if (msg === 'test2-ran') {
            ran2 = true;
            if (!!ran1 && !!ran2 && !doneCalled) {
              doneCalled = true;
              done();
              return n.send('exit');
            }
          } else {
            return done(new Error('Jobs did not run!'));
          }
        };

        const serverPath = path.join(__dirname, 'fixtures', 'agenda-instance.js');
        const n = cp.fork(serverPath, [mongoCfg, 'daily-array']);

        n.on('message', receiveMessage);
        n.on('error', serviceError);
      });

      it('should not run if job is disabled', done => {
        let counter = 0;

        jobs.define('everyDisabledTest', (job, cb) => {
          counter++;
          cb();
        });

        const job = jobs.every(10, 'everyDisabledTest');

        job.disable();

        job.save(() => {
          jobs.start();

          setTimeout(() => {
            jobs.jobs({name: 'everyDisabledTest'}, (err, res) => {
              expect(counter).to.be(0);
              jobs.stop(done);
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
            startService();
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
        let ran1 = false;
        let ran2 = false;
        let doneCalled = false;

        const serviceError = err => {
          done(err);
        };
        const receiveMessage = msg => {
          if (msg === 'test1-ran') {
            ran1 = true;
            if (!!ran1 && !!ran2 && !doneCalled) {
              doneCalled = true;
              done();
              return n.send('exit');
            }
          } else if (msg === 'test2-ran') {
            ran2 = true;
            if (!!ran1 && !!ran2 && !doneCalled) {
              doneCalled = true;
              done();
              return n.send('exit');
            }
          } else {
            return done(new Error('Jobs did not run!'));
          }
        };

        const serverPath = path.join(__dirname, 'fixtures', 'agenda-instance.js');
        const n = cp.fork(serverPath, [mongoCfg, 'schedule-array']);

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

        jobs.define('test-job', (job, cb) => {
          const id = job.attrs._id.toString();
          runCount[id] = runCount[id] ? runCount[id] + 1 : 1;
          cb();
        });

        jobs.start();

        for (let i = 0; i < 10; i++) {
          jobs.now('test-job');
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