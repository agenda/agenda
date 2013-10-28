var expect = require('expect.js'),
    mongo = require('mongoskin').db('localhost:27017/agenda-test');
    jobs = require('../index.js')({
      defaultConcurrency: 5,
      db: {
        address: 'localhost:27017/agenda-test'
      }
    }),
    Job = require('../lib/job.js');
    
before(function(done) {
  mongo.collection('agendaJobs').remove({}, done);
});

describe('Agenda', function() {
  it('sets a default processEvery', function() {
    expect(jobs._processEvery).to.be(5000);
  });

  describe('configuration methods', function() {
    describe('database', function() {
      it('sets the database', function() {
        jobs.database('localhost:27017/agenda-test');
        expect(jobs._db.skinDb._dbconn.databaseName).to.be('agenda-test');
      });
      it('sets the collection', function() {
        jobs.database('localhost:27017/agenda-test', 'myJobs');
        expect(jobs._db.collectionName).to.be('myJobs');
      });
      it('returns itself', function() {
        expect(jobs.database('localhost:27017/agenda-test')).to.be(jobs);
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
      var jobProcessor = function(job, done) { };
      before(function() {
        jobs.define('someJob', jobProcessor);
      });

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
          expect(jobs.every('5 seconds', 'send email').attrs.repeatInterval).to.be(5000);
        });
        it('sets the agenda', function() {
          expect(jobs.every('5 seconds', 'send email').agenda).to.be(jobs);
        });
      });
    });

    describe('every', function() {
      describe('with a job name specified', function() {
        it('returns a job', function() {
          expect(jobs.schedule('in 5 minutes', 'send email')).to.be.a(Job);
        });
        it('sets the schedule', function() {
          var fiveish = (new Date()).valueOf() + 250000;
          expect(jobs.schedule('in 5 minutes', 'send email').attrs.nextRunAt.valueOf()).to.be.greaterThan(fiveish);
        });
      });
    });

    describe('jobs', function() {
      it('returns jobs', function(done) {
        jobs.jobs({}, function(err, c) {
          expect(c.length).to.not.be(0);
          expect(c[0]).to.be.a(Job);
          done();
        });
      });
    });

    describe('saveJob', function() {
      it('persists job to the database', function(done) {
        var job = jobs.create('someJob', {});
        job.save(function(err, job) {
          expect(job.attrs._id).to.be.ok();
          done();
        });
      });
    });
  });
});

describe('Job', function() {
  describe('repeatEvery', function() {
    var job = new Job();;
    it('sets the repeat interval', function() {
      debugger;
      job.repeatEvery(5000);
      expect(job.attrs.repeatInterval).to.be(5000);
    });
    it('returns the job', function() {
      expect(job.repeatEvery('one second')).to.be(job);
    });
  });

  describe('schedule', function() {
    beforeEach(function() {
      job = new Job();
    });
    it('sets the next run time', function() {
      job.schedule('in 5 minutes');
      expect(job.attrs.nextRunAt).to.be.a(Date);
    });
    it('returns the job', function() {
      expect(job.schedule('tomorrow at noon')).to.be(job);
    });
  });

  describe('priority', function() {
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

    it('updates the agenda', function(done) {
      job.run(function() {
        expect(jobs._runningJobs).to.be(0);
        expect(definitions.testRun.running).to.be(0);
        done();
      });
      expect(jobs._runningJobs).to.be(1);
      expect(definitions.testRun.running).to.be(1);
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
  });

  describe('fail', function() {
    var job = new Job();
    it('sets the fail reason', function() {
      job.fail('test');
      expect(job.attrs.failReason).to.be('test');
    });
    it('sets the failedAt time', function() {
      job.fail('test');
      expect(job.attrs.failedAt).to.be.a(Date);
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

    it('returns the job', function() {
      var job = jobs.create('some job', { wee: 1});
      expect(job.save()).to.be(job);
    });
  });
});
