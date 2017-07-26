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

  describe('Agenda', function() {
    it('sets a default processEvery', function() {
      expect(jobs._processEvery).to.be(5000);
    });

    describe('configuration methods', function() {
      it('sets the _db directly when passed as an option', function() {
        var agenda = new Agenda({mongo: mongo});
        expect(agenda._mdb.databaseName).to.equal('agenda-test');
      });
    });

    describe('configuration methods', function() {
      describe('mongo', function() {
        it('sets the _db directly', function() {
          var agenda = new Agenda();
          agenda.mongo(mongo);
          expect(agenda._mdb.databaseName).to.equal('agenda-test');
        });

        it('returns itself', function() {
          var agenda = new Agenda();
          expect(agenda.mongo(mongo)).to.be(agenda);
        });
      });

      describe('name', function() {
        it('sets the agenda name', function() {
          jobs.name('test queue');
          expect(jobs._name).to.be('test queue');
        });
        it('returns itself', function() {
          expect(jobs.name('test queue')).to.be(jobs);
        });
      });

      describe('processEvery', function() {
        it('sets the processEvery time', function() {
          jobs.processEvery('3 minutes');
          expect(jobs._processEvery).to.be(180000);
        });
        it('returns itself', function() {
          expect(jobs.processEvery('3 minutes')).to.be(jobs);
        });
      });
      describe('maxConcurrency', function() {
        it('sets the maxConcurrency', function() {
          jobs.maxConcurrency(10);
          expect(jobs._maxConcurrency).to.be(10);
        });
        it('returns itself', function() {
          expect(jobs.maxConcurrency(10)).to.be(jobs);
        });
      });
      describe('defaultConcurrency', function() {
        it('sets the defaultConcurrency', function() {
          jobs.defaultConcurrency(1);
          expect(jobs._defaultConcurrency).to.be(1);
        });
        it('returns itself', function() {
          expect(jobs.defaultConcurrency(5)).to.be(jobs);
        });
      });
      describe('lockLimit', function() {
        it('sets the lockLimit', function() {
          jobs.lockLimit(10);
          expect(jobs._lockLimit).to.be(10);
        });
        it('returns itself', function() {
          expect(jobs.lockLimit(10)).to.be(jobs);
        });
      });
      describe('defaultLockLimit', function() {
        it('sets the defaultLockLimit', function() {
          jobs.defaultLockLimit(1);
          expect(jobs._defaultLockLimit).to.be(1);
        });
        it('returns itself', function() {
          expect(jobs.defaultLockLimit(5)).to.be(jobs);
        });
      });
      describe('defaultLockLifetime', function(){
        it('returns itself', function() {
          expect(jobs.defaultLockLifetime(1000)).to.be(jobs);
        });
        it('sets the default lock lifetime', function(){
          jobs.defaultLockLifetime(9999);
          expect(jobs._defaultLockLifetime).to.be(9999);
        });
        it('is inherited by jobs', function(){
          jobs.defaultLockLifetime(7777);
          jobs.define('testDefaultLockLifetime', function(job, done){});
          expect(jobs._definitions.testDefaultLockLifetime.lockLifetime).to.be(7777);
        });
      });
    });

    describe('job methods', function() {

      describe('create', function() {
        var job;
        beforeEach(function() {
          job = jobs.create('sendEmail', {to: 'some guy'});
        });

        it('returns a job', function() {
          expect(job).to.be.a(Job);
        });
        it('sets the name', function() {
          expect(job.attrs.name).to.be('sendEmail');
        });
        it('sets the type', function() {
          expect(job.attrs.type).to.be('normal');
        });
        it('sets the agenda', function() {
          expect(job.agenda).to.be(jobs);
        });
        it('sets the data', function() {
          expect(job.attrs.data).to.have.property('to', 'some guy');
        });
      });

      describe('define', function() {
        it('stores the definition for the job', function() {
          expect(jobs._definitions.someJob).to.have.property('fn', jobProcessor);
        });

        it('sets the default concurrency for the job', function() {
          expect(jobs._definitions.someJob).to.have.property('concurrency', 5);
        });

        it('sets the default lockLimit for the job', function() {
          expect(jobs._definitions.someJob).to.have.property('lockLimit', 0);
        });

        it('sets the default priority for the job', function() {
          expect(jobs._definitions.someJob).to.have.property('priority', 0);
        });
        it('takes concurrency option for the job', function() {
          jobs.define('highPriority', {priority: 10}, jobProcessor);
          expect(jobs._definitions.highPriority).to.have.property('priority', 10);
        });
      });

      describe('every', function() {
        describe('with a job name specified', function() {
          it('returns a job', function() {
            expect(jobs.every('5 minutes', 'send email')).to.be.a(Job);
          });
          it('sets the repeatEvery', function() {
            expect(jobs.every('5 seconds', 'send email').attrs.repeatInterval).to.be('5 seconds');
          });
          it('sets the agenda', function() {
            expect(jobs.every('5 seconds', 'send email').agenda).to.be(jobs);
          });
          it('should update a job that was previously scheduled with `every`', function(done) {
            jobs.every(10, 'shouldBeSingleJob');
            setTimeout(function() {
              jobs.every(20, 'shouldBeSingleJob');
            }, 10);

            // Give the saves a little time to propagate
            setTimeout(function() {
              jobs.jobs({name: 'shouldBeSingleJob'}, function(err, res) {
                expect(res).to.have.length(1);
                done();
              });
            }, jobTimeout);

          });
        });
        describe('with array of names specified', function () {
          it('returns array of jobs', function () {
            expect(jobs.every('5 minutes', ['send email', 'some job'])).to.be.an('array');
          });
        });
      });

      describe('schedule', function() {
        describe('with a job name specified', function() {
          it('returns a job', function() {
            expect(jobs.schedule('in 5 minutes', 'send email')).to.be.a(Job);
          });
          it('sets the schedule', function() {
            var fiveish = (new Date()).valueOf() + 250000;
            expect(jobs.schedule('in 5 minutes', 'send email').attrs.nextRunAt.valueOf()).to.be.greaterThan(fiveish);
          });
        });
        describe('with array of names specified', function () {
          it('returns array of jobs', function () {
            expect(jobs.schedule('5 minutes', ['send email', 'some job'])).to.be.an('array');
          });
        });
      });

      describe('unique', function() {
        describe('should demonstrate unique contraint', function(done) {
          it('should modify one job when unique matches', function(done) {
            jobs.create('unique job', {type: 'active', userId: '123', 'other': true}).unique({'data.type': 'active', 'data.userId': '123'}).schedule('now').save(function(err, job1) {
              setTimeout(function() { // Avoid timing condition where nextRunAt coincidentally is the same
                jobs.create('unique job', {type: 'active', userId: '123', 'other': false}).unique({'data.type': 'active', 'data.userId': '123'}).schedule('now').save(function(err, job2) {
                  expect(job1.attrs.nextRunAt.toISOString()).not.to.equal(job2.attrs.nextRunAt.toISOString())
                  mongo.collection('agendaJobs').find({name: 'unique job'}).toArray(function(err, j) {
                    expect(j).to.have.length(1);
                    done();
                  });
                });
              }, 1);
            });
          });

          it('should not modify job when unique matches and insertOnly is set to true', function(done) {
            jobs.create('unique job', {type: 'active', userId: '123', 'other': true}).unique({'data.type': 'active', 'data.userId': '123'}, { insertOnly: true }).schedule('now').save(function(err, job1) {
              jobs.create('unique job', {type: 'active', userId: '123', 'other': false}).unique({'data.type': 'active', 'data.userId': '123'}, {insertOnly: true}).schedule('now').save(function(err, job2) {
                expect(job1.attrs.nextRunAt.toISOString()).to.equal(job2.attrs.nextRunAt.toISOString())
                mongo.collection('agendaJobs').find({name: 'unique job'}).toArray(function(err, j) {
                  expect(j).to.have.length(1);
                  done();
                });
              });
            });
          });
        });

        describe('should demonstrate non-unique contraint', function(done) {
          it('should create two jobs when unique doesn\t match', function(done) {
            var time = new Date(Date.now() + (1000 * 60 * 3));
            var time2 = new Date(Date.now() + (1000 * 60 * 4));

            jobs.create('unique job', {type: 'active', userId: '123', 'other': true}).unique({'data.type': 'active', 'data.userId': '123', nextRunAt: time}).schedule(time).save(function(err, job) {
             jobs.create('unique job', {type: 'active', userId: '123', 'other': false}).unique({'data.type': 'active', 'data.userId': '123', nextRunAt: time2}).schedule(time).save(function(err, job) {
                mongo.collection('agendaJobs').find({name: 'unique job'}).toArray(function(err, j) {
                  expect(j).to.have.length(2);
                  done();
                });
             });
            });

          });
        });

      });

      describe('now', function() {
        it('returns a job', function() {
          expect(jobs.now('send email')).to.be.a(Job);
        });
        it('sets the schedule', function() {
          var now = new Date();
          expect(jobs.now('send email').attrs.nextRunAt.valueOf()).to.be.greaterThan(now.valueOf() - 1);
        });

        it('runs the job immediately', function(done) {
          jobs.define('immediateJob', function(job) {
            expect(job.isRunning()).to.be(true);
            jobs.stop(done);
          });
          jobs.now('immediateJob');
          jobs.start();
        });
      });

      describe('jobs', function() {
        it('returns jobs', function(done) {
          var job = jobs.create('test');
          job.save(function() {
            jobs.jobs({}, function(err, c) {
              expect(c.length).to.not.be(0);
              expect(c[0]).to.be.a(Job);
              clearJobs(done);
            });
          });
        });
      });

      describe('purge', function() {
        it('removes all jobs without definitions', function(done) {
          var job = jobs.create('no definition');
          jobs.stop(function() {
            job.save(function() {
              jobs.jobs({name: 'no definition'}, function(err, j) {
                if(err) return done(err);
                expect(j).to.have.length(1);
                jobs.purge(function(err) {
                  if(err) return done(err);
                  jobs.jobs({name: 'no definition'}, function(err, j) {
                    if(err) return done(err);
                    expect(j).to.have.length(0);
                    done();
                  });
                });
              });
            });
          });
        });
      });

      describe('saveJob', function() {
        it('persists job to the database', function(done) {
          var job = jobs.create('someJob', {});
          job.save(function(err, job) {
            expect(job.attrs._id).to.be.ok();
            clearJobs(done);
          });
        });
      });
    });

    describe('cancel', function() {
      beforeEach(function(done) {
        var remaining = 3;
        var checkDone = function(err) {
          if(err) return done(err);
          remaining--;
          if(!remaining) {
            done();
          }
        };
        jobs.create('jobA').save(checkDone);
        jobs.create('jobA', 'someData').save(checkDone);
        jobs.create('jobB').save(checkDone);
      });

      afterEach(function(done) {
        jobs._collection.remove({name: {$in: ['jobA', 'jobB']}}, function(err) {
          if(err) return done(err);
          done();
        });
      });

      it('should cancel a job', function(done) {
        jobs.jobs({name: 'jobA'}, function(err, j) {
          if(err) return done(err);
          expect(j).to.have.length(2);
          jobs.cancel({name: 'jobA'}, function(err) {
            if(err) return done(err);
            jobs.jobs({name: 'jobA'}, function(err, j) {
              if(err) return done(err);
              expect(j).to.have.length(0);
              done();
            });
          });
        });
      });

      it('should cancel multiple jobs', function(done) {
        jobs.jobs({name: {$in: ['jobA', 'jobB']}}, function(err, j) {
          if(err) return done(err);
          expect(j).to.have.length(3);
          jobs.cancel({name: {$in: ['jobA', 'jobB']}}, function(err) {
            if(err) return done(err);
            jobs.jobs({name: {$in: ['jobA', 'jobB']}}, function(err, j) {
              if(err) return done(err);
              expect(j).to.have.length(0);
              done();
            });
          });
        });
      });

      it('should cancel jobs only if the data matches', function(done){
        jobs.jobs({name: 'jobA', data: 'someData'}, function(err, j) {
          if(err) return done(err);
          expect(j).to.have.length(1);
          jobs.cancel({name: 'jobA', data: 'someData'}, function(err) {
            if(err) return done(err);
            jobs.jobs({name: 'jobA', data: 'someData'}, function(err, j) {
              if(err) return done(err);
              expect(j).to.have.length(0);
              jobs.jobs({name: 'jobA'}, function(err, j) {
                if(err) return done(err);
                expect(j).to.have.length(1);
                done();
              });
            });
          });
        });
      });
    });
  });
});