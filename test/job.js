/* globals before, describe, it, beforeEach, after, afterEach */
const expect = require('expect.js');
const path = require('path');
const moment = require('moment-timezone');
const cp = require('child_process');
const Agenda = require('../index');
const Job = require('../lib/job');
const MongoClient = require('mongodb').MongoClient;

const mongoHost = process.env.MONGODB_HOST || 'localhost';
const mongoPort = process.env.MONGODB_PORT || '27017';
const mongoCfg = 'mongodb://' + mongoHost + ':' + mongoPort + '/agenda-test';

// create agenda instances
var jobs = null;
var mongo = null;

function clearJobs(done) {
  mongo.collection('agendaJobs').remove({}, done);
}

// Slow timeouts for Travis
const jobTimeout = process.env.TRAVIS ? 3500 : 500;
const jobType = 'do work';
const jobProcessor  = function(job) {};

function failOnError(err) {
  if (err) {
    throw err;
  }
}

describe('agenda', function() {
  beforeEach(function(done) {
    jobs = new Agenda({
      db: {
        address: mongoCfg
      }
    }, function(err) {
      MongoClient.connect(mongoCfg, function( error, db ){
        mongo = db;
        setTimeout(function() {
          clearJobs(function() {
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

  afterEach(function(done) {
    setTimeout(function() {
      jobs.stop(function() {
        clearJobs(function() {
          mongo.close(function() {
            jobs._mdb.close(done);
          });
        });
      });
    }, 50);
  });

  describe('Job', function() {
    describe('repeatAt', function() {
      var job = new Job();
      it('sets the repeat at', function() {
        job.repeatAt('3:30pm');
        expect(job.attrs.repeatAt).to.be('3:30pm');
      });
      it('returns the job', function() {
        expect(job.repeatAt('3:30pm')).to.be(job);
      });
    });

    describe('unique', function() {
      var job = new Job();
      it('sets the unique property', function() {
        job.unique({'data.type': 'active', 'data.userId': '123'});
        expect(JSON.stringify(job.attrs.unique)).to.be(JSON.stringify({'data.type': 'active', 'data.userId': '123'}));
      });
      it('returns the job', function() {
        expect(job.unique({'data.type': 'active', 'data.userId': '123'})).to.be(job);
      });
    });

    describe('repeatEvery', function() {
      var job = new Job();
      it('sets the repeat interval', function() {
        job.repeatEvery(5000);
        expect(job.attrs.repeatInterval).to.be(5000);
      });
      it('returns the job', function() {
        expect(job.repeatEvery('one second')).to.be(job);
      });
    });

    describe('schedule', function() {
      var job;
      beforeEach(function() {
        job = new Job();
      });
      it('sets the next run time', function() {
        job.schedule('in 5 minutes');
        expect(job.attrs.nextRunAt).to.be.a(Date);
      });
      it('sets the next run time Date object', function() {
        var when = new Date(Date.now() + 1000*60*3);
        job.schedule(when);
        expect(job.attrs.nextRunAt).to.be.a(Date);
        expect(job.attrs.nextRunAt.getTime()).to.eql(when.getTime());
      });
      it('returns the job', function() {
        expect(job.schedule('tomorrow at noon')).to.be(job);
      });
    });

    describe('priority', function() {
      var job;
      beforeEach(function() {
        job = new Job();
      });
      it('sets the priority to a number', function() {
        job.priority(10);
        expect(job.attrs.priority).to.be(10);
      });
      it('returns the job', function() {
        expect(job.priority(50)).to.be(job);
      });
      it('parses written priorities', function() {
        job.priority('high');
        expect(job.attrs.priority).to.be(10);
      });
    });

    describe('computeNextRunAt', function() {
      var job;

      beforeEach(function() {
        job = new Job();
      });

      it('returns the job', function() {
        expect(job.computeNextRunAt()).to.be(job);
      });

      it('sets to undefined if no repeat at', function() {
        job.attrs.repeatAt = null;
        job.computeNextRunAt();
        expect(job.attrs.nextRunAt).to.be(undefined);
      });

      it('it understands repeatAt times', function() {
        var d = new Date();
        d.setHours(23);
        d.setMinutes(59);
        d.setSeconds(0);
        job.attrs.repeatAt = '11:59pm';
        job.computeNextRunAt();
        expect(job.attrs.nextRunAt.getHours()).to.be(d.getHours());
        expect(job.attrs.nextRunAt.getMinutes()).to.be(d.getMinutes());
      });

      it('sets to undefined if no repeat interval', function() {
        job.attrs.repeatInterval = null;
        job.computeNextRunAt();
        expect(job.attrs.nextRunAt).to.be(undefined);
      });

      it('it understands human intervals', function() {
        var now = new Date();
        job.attrs.lastRunAt = now;
        job.repeatEvery('2 minutes');
        job.computeNextRunAt();
        expect(job.attrs.nextRunAt).to.be(now.valueOf() + 120000);
      });

      it('understands cron intervals', function() {
        var now = new Date();
        now.setMinutes(1);
        now.setMilliseconds(0);
        now.setSeconds(0);
        job.attrs.lastRunAt = now;
        job.repeatEvery('*/2 * * * *');
        job.computeNextRunAt();
        expect(job.attrs.nextRunAt.valueOf()).to.be(now.valueOf() + 60000);
      });

      it('understands cron intervals with a timezone', function () {
        var date = new Date('2015-01-01T06:01:00-00:00');
        job.attrs.lastRunAt = date;
        job.repeatEvery('0 6 * * *', {
          timezone: 'GMT'
        });
        job.computeNextRunAt();
        expect(moment(job.attrs.nextRunAt).tz('GMT').hour()).to.be(6);
        expect(moment(job.attrs.nextRunAt).toDate().getDate()).to.be(moment(job.attrs.lastRunAt).add(1, 'days').toDate().getDate());
      });

      it('understands cron intervals with a timezone when last run is the same as the interval', function () {
        var date = new Date('2015-01-01T06:00:00-00:00');
        job.attrs.lastRunAt = date;
        job.repeatEvery('0 6 * * *', {
          timezone: 'GMT'
        });
        job.computeNextRunAt();
        expect(moment(job.attrs.nextRunAt).tz('GMT').hour()).to.be(6);
        expect(moment(job.attrs.nextRunAt).toDate().getDate()).to.be(moment(job.attrs.lastRunAt).add(1, 'days').toDate().getDate());
      });

      describe('when repeat at time is invalid', function () {
        beforeEach(function () {
          try {
            job.attrs.repeatAt = 'foo';
            job.computeNextRunAt();
          } catch(e) {}
        });

        it('sets nextRunAt to undefined', function () {
          expect(job.attrs.nextRunAt).to.be(undefined);
        });

        it('fails the job', function () {
          expect(job.attrs.failReason).to.equal('failed to calculate repeatAt time due to invalid format');
        });
      });

      describe('when repeat interval is invalid', function () {
        beforeEach(function () {
          try {
            job.attrs.repeatInterval = 'asd';
            job.computeNextRunAt();
          } catch(e) {}
        });

        it('sets nextRunAt to undefined', function () {
          expect(job.attrs.nextRunAt).to.be(undefined);
        });

        it('fails the job', function () {
          expect(job.attrs.failReason).to.equal('failed to calculate nextRunAt due to invalid repeat interval');
        });
      });

    });

    describe('remove', function() {
      it('removes the job', function(done) {
        var job = new Job({agenda: jobs, name: 'removed job'});
        job.save(function(err) {
          if(err) return done(err);
          job.remove(function(err) {
            if(err) return done(err);
            mongo.collection('agendaJobs').find({_id: job.attrs._id}).toArray(function(err, j) {
              expect(j).to.have.length(0);
              done();
            });
          });
        });
      });
    });

    describe('run', function() {
      var job;

      beforeEach(function() {
        jobs.define('testRun', function(job, done) {
          setTimeout(function() {
            done();
          }, 100);
        });

        job = new Job({agenda: jobs, name: 'testRun'});
      });

      it('updates lastRunAt', function(done) {
        var now = new Date();
        setTimeout(function() {
          job.run(function() {
            expect(job.attrs.lastRunAt.valueOf()).to.be.greaterThan(now.valueOf());
            done();
          });
        }, 5);
      });

      it('fails if job is undefined', function(done) {
        job = new Job({agenda: jobs, name: 'not defined'});
        job.run(function() {
          expect(job.attrs.failedAt).to.be.ok();
          expect(job.attrs.failReason).to.be('Undefined job');
          done();
        });
      });
      it('updates nextRunAt', function(done) {
        var now = new Date();
        job.repeatEvery('10 minutes');
        setTimeout(function() {
          job.run(function() {
            expect(job.attrs.nextRunAt.valueOf()).to.be.greaterThan(now.valueOf() + 59999);
            done();
          });
        }, 5);
      });
      it('handles errors', function(done) {
        job.attrs.name = 'failBoat';
        jobs.define('failBoat', function(job, cb) {
          throw(new Error('Zomg fail'));
        });
        job.run(function(err) {
          expect(err).to.be.ok();
          done();
        });
      });
      it('handles errors with q promises', function(done) {
        job.attrs.name = 'failBoat2';
        jobs.define('failBoat2', function(job, cb) {
          var Q = require('q');
          Q.delay(100).then(function(){
            throw(new Error('Zomg fail'));
          }).fail(cb).done();
        });
        job.run(function(err) {
          expect(err).to.be.ok();
          done();
        });
      });

      it('doesn\'t allow a stale job to be saved', function(done) {
        var flag = false;
        job.attrs.name = 'failBoat3';
        job.save(function(err) {
          if(err) return done(err);
          jobs.define('failBoat3', function(job, cb) {
            // Explicitly find the job again,
            // so we have a new job object
            jobs.jobs({name: 'failBoat3'}, function(err, j) {
              if(err) return done(err);
              j[0].remove(function(err) {
                if(err) return done(err);
                cb();
              });
            });
          });

          job.run(function(err) {
            // Expect the deleted job to not exist in the database
            jobs.jobs({name: 'failBoat3'}, function(err, j) {
              if(err) return done(err);
              expect(j).to.have.length(0);
              done();
            });
          });
        });
      });

    });

    describe('touch', function(done) {
      it('extends the lock lifetime', function(done) {
        var lockedAt = new Date();
        var job = new Job({agenda: jobs, name: 'some job', lockedAt: lockedAt});
        job.save = function(cb) { cb(); };
        setTimeout(function() {
          job.touch(function() {
            expect(job.attrs.lockedAt).to.be.greaterThan(lockedAt);
            done();
          });
        }, 2);
      });
    });

    describe('fail', function() {
      var job = new Job();
      it('takes a string', function() {
        job.fail('test');
        expect(job.attrs.failReason).to.be('test');
      });
      it('takes an error object', function() {
        job.fail(new Error('test'));
        expect(job.attrs.failReason).to.be('test');
      });
      it('sets the failedAt time', function() {
        job.fail('test');
        expect(job.attrs.failedAt).to.be.a(Date);
      });
      it('sets the failedAt time equal to lastFinishedAt time', function() {
        job.fail('test');
        expect(job.attrs.failedAt).to.be.equal(job.attrs.lastFinishedAt);
      });
    });

    describe('enable', function() {
      it('sets disabled to false on the job', function() {
        var job = new Job({disabled: true});
        job.enable();
        expect(job.attrs.disabled).to.be(false);
      });

      it('returns the job', function() {
        var job = new Job({disabled: true});
        expect(job.enable()).to.be(job);
      });
    });

    describe('disable', function() {
      it('sets disabled to true on the job', function() {
        var job = new Job();
        job.disable();
        expect(job.attrs.disabled).to.be(true);
      });
      it('returns the job', function() {
        var job = new Job();
        expect(job.disable()).to.be(job);
      });
    });

    describe('save', function() {
      it('calls saveJob on the agenda', function(done) {
        var oldSaveJob = jobs.saveJob;
        jobs.saveJob = function() {
          jobs.saveJob = oldSaveJob;
          done();
        };
        var job = jobs.create('some job', { wee: 1});
        job.save();
      });

      it('doesnt save the job if its been removed', function(done) {
        var job = jobs.create('another job');
        // Save, then remove, then try and save again.
        // The second save should fail.
        job.save(function(err, j) {
          j.remove(function() {
            j.save(function(err, res) {
              jobs.jobs({name: 'another job'}, function(err, res) {
                expect(res).to.have.length(0);
                done();
              });
            });
          });
        });
      });

      it('returns the job', function() {
        var job = jobs.create('some job', { wee: 1});
        expect(job.save()).to.be(job);
      });
    });

    describe('start/stop', function() {
      it('starts/stops the job queue', function(done) {
        jobs.define('jobQueueTest', function jobQueueTest(job, cb) {
          jobs.stop(function() {
            clearJobs(function() {
              cb();
              jobs.define('jobQueueTest', function(job, cb) {
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

      it('does not run disabled jobs', function(done) {
        var ran = false;
        jobs.define('disabledJob', function() {
          ran = true;
        });
        var job = jobs.create('disabledJob').disable().schedule('now');
        job.save(function(err) {
          if (err) return done(err);
          jobs.start();
          setTimeout(function() {
            expect(ran).to.be(false);
            jobs.stop(done);
          }, jobTimeout);
        });
      });

      it('does not throw an error trying to process undefined jobs', function(done) {
        jobs.start();
        var job = jobs.create('jobDefinedOnAnotherServer').schedule('now');

        job.save(function(err) {
          expect(err).to.be(null);
        });

        setTimeout(function() {
          jobs.stop(done);
        }, jobTimeout);
      });

      it('clears locks on stop', function(done) {
        jobs.define('longRunningJob', function(job, cb) {
          //Job never finishes
        });
        jobs.every('10 seconds', 'longRunningJob');
        jobs.processEvery('1 second');
        jobs.start();
        setTimeout(function() {
          jobs.stop(function(err, res) {
            jobs._collection.findOne({name: 'longRunningJob'}, function(err, job) {
              expect(job.lockedAt).to.be(null);
              done();
            });
          });
        }, jobTimeout);
      });

      describe('events', function() {
        beforeEach(function() {
          jobs.define('jobQueueTest', function jobQueueTest(job, cb) {
            cb();
          });
          jobs.define('failBoat', function(job, cb) {
            throw(new Error('Zomg fail'));
          });
        });

        it('emits start event', function(done) {
          var job = new Job({agenda: jobs, name: 'jobQueueTest'});
          jobs.once('start', function(j) {
            expect(j).to.be(job);
            done();
          });
          job.run();
        });
        it('emits start:job name event', function(done) {
          var job = new Job({agenda: jobs, name: 'jobQueueTest'});
          jobs.once('start:jobQueueTest', function(j) {
            expect(j).to.be(job);
            done();
          });
          job.run();
        });
        it('emits complete event', function(done) {
          var job = new Job({agenda: jobs, name: 'jobQueueTest'});
          jobs.once('complete', function(j) {
            expect(job.attrs._id.toString()).to.be(j.attrs._id.toString());
            done();
          });
          job.run();
        });
        it('emits complete:job name event', function(done) {
          var job = new Job({agenda: jobs, name: 'jobQueueTest'});
          jobs.once('complete:jobQueueTest', function(j) {
            expect(job.attrs._id.toString()).to.be(j.attrs._id.toString());
            done();
          });
          job.run();
        });
        it('emits success event', function(done) {
          var job = new Job({agenda: jobs, name: 'jobQueueTest'});
          jobs.once('success', function(j) {
            expect(j).to.be.ok();
            done();
          });
          job.run();
        });
        it('emits success:job name event', function(done) {
          var job = new Job({agenda: jobs, name: 'jobQueueTest'});
          jobs.once('success:jobQueueTest', function(j) {
            expect(j).to.be.ok();
            done();
          });
          job.run();
        });
        it('emits fail event', function(done){
          var job = new Job({agenda: jobs, name: 'failBoat'});
          jobs.once('fail', function(err, j) {
            expect(err.message).to.be('Zomg fail');
            expect(j).to.be(job);
            expect(j.attrs.failCount).to.be(1);
            expect(j.attrs.failedAt.valueOf()).not.to.be.below(j.attrs.lastFinishedAt.valueOf());

            jobs.once('fail', function(err, j) {
              expect(j).to.be(job);
              expect(j.attrs.failCount).to.be(2);
              done();
            });
            job.run();
          });
          job.run();
        });
        it('emits fail:job name event', function(done) {
          var job = new Job({agenda: jobs, name: 'failBoat'});
          jobs.once('fail:failBoat', function(err, j) {
            expect(err.message).to.be('Zomg fail');
            expect(j).to.be(job);
            done();
          });
          job.run();
        });
      });
    });

    describe('job lock', function(){

      it('runs a recurring job after a lock has expired', function(done) {
        var startCounter = 0;

        jobs.define('lock job', {lockLifetime: 50}, function(job, cb){
          startCounter++;

          if(startCounter != 1) {
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

      it('runs a one-time job after its lock expires', function (done) {
        var runCount = 0;

        jobs.define('lock job', {
          lockLifetime: 50
        }, function (job, cb) {
          runCount++;

          if(runCount !== 1) {
            expect(runCount).to.be(2);
            jobs.stop(done);
          }
        });

        jobs.processEvery(50);
        jobs.start();
        jobs.now('lock job', { i: 1 });
      });

      it('does not process locked jobs', function(done) {
        var history = [];

        jobs.define('lock job', {
          lockLifetime: 300
        }, function(job, cb) {
          history.push(job.attrs.data.i);

          setTimeout(function() {
            cb();
          }, 150);
        });

        jobs.start();

        jobs.now('lock job', { i: 1 });
        jobs.now('lock job', { i: 2 });
        jobs.now('lock job', { i: 3 });

        setTimeout(function() {
          expect(history).to.have.length(3);
          expect(history).to.contain(1);
          expect(history).to.contain(2);
          expect(history).to.contain(3);
          done();
        }, 500);
      });

      it('does not on-the-fly lock more than agenda._lockLimit jobs', function (done) {
        jobs.lockLimit(1);

        jobs.define('lock job', function (job, cb) {});

        jobs.start();

        setTimeout(function () {
          jobs.now('lock job', { i: 1 });
          jobs.now('lock job', { i: 2 });

          setTimeout(function () {
            expect(jobs._lockedJobs).to.have.length(1);
            jobs.stop(done);
          }, 500);
        }, 500);
      });

      it('does not on-the-fly lock more than definition.lockLimit jobs', function (done) {
        jobs.define('lock job', {
          lockLimit: 1
        }, function (job, cb) {});

        jobs.start();

        setTimeout(function () {
          jobs.now('lock job', { i: 1 });
          jobs.now('lock job', { i: 2 });

          setTimeout(function () {
            expect(jobs._lockedJobs).to.have.length(1);
            jobs.stop(done);
          }, 500);
        }, 500);
      });

      it('does not lock more than agenda._lockLimit jobs during processing interval', function (done) {
        jobs.lockLimit(1);
        jobs.processEvery(200);

        jobs.define('lock job', function (job, cb) {});

        jobs.start();

        var when = moment().add(300, 'ms').toDate();

        jobs.schedule(when, 'lock job', { i: 1 });
        jobs.schedule(when, 'lock job', { i: 2 });

        setTimeout(function () {
          expect(jobs._lockedJobs).to.have.length(1);
          jobs.stop(done);
        }, 500);
      });

      it('does not lock more than definition.lockLimit jobs during processing interval', function (done) {
        jobs.processEvery(200);

        jobs.define('lock job', {
          lockLimit: 1
        }, function (job, cb) {});

        jobs.start();

        var when = moment().add(300, 'ms').toDate();

        jobs.schedule(when, 'lock job', { i: 1 });
        jobs.schedule(when, 'lock job', { i: 2 });

        setTimeout(function () {
          expect(jobs._lockedJobs).to.have.length(1);
          jobs.stop(done);
        }, 500);
      });

    });

    describe('job concurrency', function () {

      it('should not block a job for concurrency of another job', function (done) {
        jobs.processEvery(50);

        var processed = [];
        var now = Date.now();

        jobs.define('blocking', {
          concurrency: 1
        }, function (job, cb) {
          processed.push(job.attrs.data.i);
          setTimeout(cb, 400);
        });

        jobs.define('non-blocking', {
          // Lower priority to keep it at the back in the queue
          priority: 'lowest'
        }, function (job) {
          processed.push(job.attrs.data.i);
          expect(processed).not.to.contain(2);
        });

        var finished = false;
        jobs.on('complete', function (job) {
          if(!finished && processed.length === 3) {
            finished = true;
            done();
          }
        });

        jobs.on('fail', function (err, job) {
          expect(err).to.be(undefined);
        })

        jobs.start();

        jobs.schedule(new Date(now + 100), 'blocking', { i: 1 });

        setTimeout(function () {
          jobs.schedule(new Date(now + 100), 'blocking', { i: 2 });
          jobs.schedule(new Date(now + 100), 'non-blocking', { i: 3 });
        }, 100);
      });

    });

    describe('every running', function() {
      beforeEach(function(done) {
        jobs.defaultConcurrency(1);
        jobs.processEvery(5);

        jobs.stop(done);
      });

      it('should run the same job multiple times', function(done) {
        var counter = 0;

        jobs.define('everyRunTest1', function(job, cb) {
          if(counter < 2) {
            counter++;
          }
          cb();
        });

        jobs.every(10, 'everyRunTest1');

        jobs.start();

        setTimeout(function() {
          jobs.jobs({name: 'everyRunTest1'}, function(err, res) {
            expect(counter).to.be(2);
            jobs.stop(done);
          });
        }, jobTimeout);
      });

      it('should reuse the same job on multiple runs', function(done) {
        var counter = 0;

        jobs.define('everyRunTest2', function(job, cb) {
          if(counter < 2) {
            counter++;
          }
          cb();
        });
        jobs.every(10, 'everyRunTest2');

        jobs.start();

        setTimeout(function() {
          jobs.jobs({name: 'everyRunTest2'}, function(err, res) {
            expect(res).to.have.length(1);
            jobs.stop(done);
          });
        }, jobTimeout);
      });
    });

    describe('Integration Tests', function() {

      describe('.every()', function() {

        it('Should not rerun completed jobs after restart', function(done) {
          var i = 0;

          var serviceError = function(e) { done(e); };
          var receiveMessage = function(msg) {
            if( msg == 'ran' ) {
              expect(i).to.be(0);
              i += 1;
              startService();
            } else if( msg == 'notRan' ) {
              expect(i).to.be(1);
              done();
            } else return done( new Error('Unexpected response returned!') );
          };

          var startService = function() {
            var serverPath = path.join( __dirname, 'fixtures', 'agenda-instance.js' );
            var n = cp.fork( serverPath, [ mongoCfg, 'daily' ] );

            n.on('message', receiveMessage);
            n.on('error', serviceError);
          };

          startService();
        });

        it('Should properly run jobs when defined via an array', function(done) {
          var ran1 = false, ran2 = true, doneCalled = false;

          var serviceError = function(e) { done(e); };
          var receiveMessage = function(msg) {
            if( msg == 'test1-ran' ) {
              ran1 = true;
              if( !!ran1 && !!ran2 && !doneCalled) {
                doneCalled = true;
                done();
                return n.send('exit');
              }
            } else if( msg == 'test2-ran') {
              ran2 = true;
              if( !!ran1 && !!ran2 && !doneCalled) {
                doneCalled = true;
                done();
                return n.send('exit');
              }
            } else return done( new Error('Jobs did not run!') );
          };


          var serverPath = path.join( __dirname, 'fixtures', 'agenda-instance.js' );
          var n = cp.fork( serverPath, [ mongoCfg, 'daily-array' ] );

          n.on('message', receiveMessage);
          n.on('error', serviceError);
        });

        it('should not run if job is disabled', function(done) {
          var counter = 0;

          jobs.define('everyDisabledTest', function(job, cb) {
            counter++;
            cb();
          });

          var job = jobs.every(10, 'everyDisabledTest');

          job.disable();

          job.save(function() {
            jobs.start();

            setTimeout(function() {
              jobs.jobs({name: 'everyDisabledTest'}, function(err, res) {
                expect(counter).to.be(0);
                jobs.stop(done);
              });
            }, jobTimeout);
          });
        });

      });

      describe('schedule()', function() {

        it('Should not run jobs scheduled in the future', function(done) {
          var i = 0;

          var serviceError = function(e) { done(e); };
          var receiveMessage = function(msg) {
            if( msg == 'notRan' ) {
              if( i < 5 ) return done();

              i += 1;
              startService();
            } else return done( new Error('Job scheduled in future was ran!') );
          };

          var startService = function() {
            var serverPath = path.join( __dirname, 'fixtures', 'agenda-instance.js' );
            var n = cp.fork( serverPath, [ mongoCfg, 'define-future-job' ] );

            n.on('message', receiveMessage);
            n.on('error', serviceError);
          };

          startService();
        });

        it('Should run past due jobs when process starts', function(done) {

          var serviceError = function(e) { done(e); };
          var receiveMessage = function(msg) {
            if( msg == 'ran' ) {
              done();
            } else return done( new Error('Past due job did not run!') );
          };

          var startService = function() {
            var serverPath = path.join( __dirname, 'fixtures', 'agenda-instance.js' );
            var n = cp.fork( serverPath, [ mongoCfg, 'define-past-due-job' ] );

            n.on('message', receiveMessage);
            n.on('error', serviceError);
          };

          startService();
        });

        it('Should schedule using array of names', function(done) {
          var ran1 = false, ran2 = false, doneCalled = false;

          var serviceError = function(e) { done(e); };
          var receiveMessage = function(msg) {

            if( msg == 'test1-ran' ) {
              ran1 = true;
              if( !!ran1 && !!ran2 && !doneCalled) {
                doneCalled = true;
                done();
                return n.send('exit');
              }
            } else if( msg == 'test2-ran') {
              ran2 = true;
              if( !!ran1 && !!ran2 && !doneCalled) {
                doneCalled = true;
                done();
                return n.send('exit');
              }
            } else return done( new Error('Jobs did not run!') );
          };


          var serverPath = path.join( __dirname, 'fixtures', 'agenda-instance.js' );
          var n = cp.fork( serverPath, [ mongoCfg, 'schedule-array' ] );

          n.on('message', receiveMessage);
          n.on('error', serviceError);
        });

      });

      describe('now()', function() {

        it('Should immediately run the job', function(done) {
          var serviceError = function(e) { done(e); };
          var receiveMessage = function(msg) {
            if( msg == 'ran' ) {
              return done();
            } else return done( new Error('Job did not immediately run!') );
          };

          var serverPath = path.join( __dirname, 'fixtures', 'agenda-instance.js' );
          var n = cp.fork( serverPath, [ mongoCfg, 'now' ] );

          n.on('message', receiveMessage);
          n.on('error', serviceError);

        });

      });

      describe('General Integration', function () {

        it('Should not run a job that has already been run', function (done) {
          var runCount = {};

          jobs.define('test-job', function (job, cb) {
            var id = job.attrs._id.toString();
            runCount[id] = runCount[id] ? runCount[id] + 1 : 1;
            cb();
          });

          jobs.start();

          for(var i = 0; i < 10; i ++) {
            jobs.now('test-job');
          }

          setTimeout(function () {
            var ids = Object.keys(runCount);
            expect(ids).to.have.length(10);
            Object.keys(runCount).forEach(function (id) {
              expect(runCount[id]).to.be(1);
            })
            done();
          }, jobTimeout);
        });
      });
    });

  });
});