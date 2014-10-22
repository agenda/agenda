/* globals before, describe, it, beforeEach, after, afterEach */

var mongoCfg = 'localhost:27017/agenda-test',
    expect = require('expect.js'),
    path = require('path'),
    cp = require('child_process'),
    mongo = require('mongoskin').db('mongodb://' + mongoCfg, {w: 0}),
    Agenda = require( path.join('..', 'index.js') ),
    jobs = new Agenda({
      defaultConcurrency: 5,
      db: {
        address: mongoCfg
      }
    }),
    Job = require( path.join('..', 'lib', 'job.js') );

function clearJobs(done) {
  mongo.collection('agendaJobs').remove({}, done);
}

// Slow timeouts for travis
var jobTimeout = process.env.TRAVIS ? 1000 : 300;

before(clearJobs);

var jobProcessor = function(job) { };
before(function() {
  jobs.define('someJob', jobProcessor);
  jobs.define('send email', jobProcessor);
  jobs.define('some job', jobProcessor);
});

describe('Agenda', function() {
  it('sets a default processEvery', function() {
    expect(jobs._processEvery).to.be(5000);
  });

  describe('configuration methods', function() {
    describe('database', function() {
      it('sets the database', function() {
        jobs.database('localhost:27017/agenda-test-new');
        expect(jobs._db._skin_db._connect_args[0]).to.contain('agenda-test-new');
      });
      it('sets the collection', function() {
        jobs.database(mongoCfg, 'myJobs');
        expect(jobs._db._collection_args[0]).to.be('myJobs');
      });
      it('returns itself', function() {
        expect(jobs.database(mongoCfg)).to.be(jobs);
      });
    });

    describe('mongo', function() {
      it('sets the _db directly', function() {
        var agenda = new Agenda();
        agenda.mongo({hello: 'world'});
        expect(agenda._db).to.have.property('hello', 'world');
      });

      it('returns itself', function() {
        var agenda = new Agenda();
        expect(agenda.mongo({hello: 'world'})).to.be(agenda);
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
      after(clearJobs);
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
      after(clearJobs);
    });

    describe('unique', function() {

      describe('should demonstrate unique contraint', function(done) {
        
        it('should create one job when unique matches', function(done) {
          var time = new Date();
          jobs.create('unique job', {type: 'active', userId: '123', 'other': true}).unique({'data.type': 'active', 'data.userId': '123', nextRunAt: time}).schedule(time).save(function(err, job) {
           jobs.create('unique job', {type: 'active', userId: '123', 'other': false}).unique({'data.type': 'active', 'data.userId': '123', nextRunAt: time}).schedule(time).save(function(err, job) {
              mongo.collection('agendaJobs').find({name: 'unique job'}).toArray(function(err, j) {
                expect(j).to.have.length(1);
                done();
              });
           });
          });
        });
        after(clearJobs);
        
      });

      describe('should demonstrate non-unique contraint', function(done) {
        
        it('should create two jobs when unique doesn\t match', function(done) {
          var time = new Date(Date.now() + 1000*60*3);
          var time2 = new Date(Date.now() + 1000*60*4);
        
          jobs.create('unique job', {type: 'active', userId: '123', 'other': true}).unique({'data.type': 'active', 'data.userId': '123', nextRunAt: time}).schedule(time).save(function(err, job) {
           jobs.create('unique job', {type: 'active', userId: '123', 'other': false}).unique({'data.type': 'active', 'data.userId': '123', nextRunAt: time2}).schedule(time).save(function(err, job) {
              mongo.collection('agendaJobs').find({name: 'unique job'}).toArray(function(err, j) {
                expect(j).to.have.length(2);
                done();
              });
           });
          });

        });
        after(clearJobs);        

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
          jobs.stop(done);
        });
        jobs.now('immediateJob');
        jobs.start();
      });
      after(clearJobs);
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
      jobs._db.remove({name: {$in: ['jobA', 'jobB']}}, function(err) {
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
    var job,
        definitions = jobs._definitions;

    jobs.define('testRun', function(job, done) {
      setTimeout(function() {
        done();
      }, 100);
    });

    beforeEach(function() {
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
        throw(new Error("Zomg fail"));
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
          throw(new Error("Zomg fail"));
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

  describe("start/stop", function() {
    it("starts/stops the job queue", function(done) {
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

    it('clears locks on stop', function(done) {
      jobs.define('longRunningJob', function(job, cb) {
        //Job never finishes
      });
      jobs.every('10 seconds', 'longRunningJob');
      jobs.processEvery('1 second');
      jobs.start();
      setTimeout(function() {
        jobs.stop(function(err, res) {
          jobs._db.findOne({name: 'longRunningJob'}, function(err, job) {
            expect(job.lockedAt).to.be(null);
            done();
          });
        });
      }, jobTimeout);
    });

    describe('events', function() {
      beforeEach(clearJobs);
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
          expect(j).to.be(job);
          done();
        });
        job.run();
      });
      it('emits complete:job name event', function(done) {
        var job = new Job({agenda: jobs, name: 'jobQueueTest'});
        jobs.once('complete:jobQueueTest', function(j) {
          expect(j).to.be(job);
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
          done();
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

  describe("job lock", function(){

    it("runs job after a lock has expired", function(done) {
      var startCounter = 0;

      jobs.define("lock job", {lockLifetime: 50}, function(job, cb){
        startCounter++;

        if(startCounter != 1) {
          expect(startCounter).to.be(2);
          jobs.stop(done);
        }
      });

      expect(jobs._definitions["lock job"].lockLifetime).to.be(50);

      jobs.defaultConcurrency(100);
      jobs.processEvery(10);
      jobs.every('0.02 seconds', 'lock job');
      jobs.stop();
      jobs.start();
    });

  });

  describe("every running", function() {
    before(function(done) {
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

  describe("Integration Tests", function() {

    describe('.every()', function() {

      it('Should not rerun completed jobs after restart', function(done) {
        var i = 0;

        var serviceError = function(e) { done(e); };
        var receiveMessage = function(msg) {
          if( msg == "ran" ) {
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
          if( msg == "test1-ran" ) {
            ran1 = true;
            if( !!ran1 && !!ran2 && !doneCalled) {
              doneCalled = true;
              done();
              return n.send('exit');
            }
          } else if( msg == "test2-ran") {
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

          if( msg == "test1-ran" ) {
            ran1 = true;
            if( !!ran1 && !!ran2 && !doneCalled) {
              doneCalled = true;
              done();
              return n.send('exit');
            }
          } else if( msg == "test2-ran") {
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
          } else return done( new Error("Job did not immediately run!") );
        };

        var serverPath = path.join( __dirname, 'fixtures', 'agenda-instance.js' );
        var n = cp.fork( serverPath, [ mongoCfg, 'now' ] );

        n.on('message', receiveMessage);
        n.on('error', serviceError);

      });

    });
  });
});
