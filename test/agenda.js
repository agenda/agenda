/* globals before, describe, it, beforeEach, after, afterEach */
var mongoHost = process.env.MONGODB_HOST || 'localhost',
    mongoPort = process.env.MONGODB_PORT || '27017',
    mongoCfg = 'mongodb://' + mongoHost + ':' + mongoPort + '/agenda-test';

var expect = require('expect.js'),
    path = require('path'),
    Agenda = require( path.join('..', 'index.js') );

var MongoClient = require('mongodb').MongoClient;
var mongo = null;

// create agenda instance
var jobs = new Agenda({
  processEvery: '0.1 seconds',
  db: {
    address: mongoCfg
  }
});

var jobType = 'do werk';
jobs.define(jobType, function(job, done) {
  done();
});

function failOnError(err) {
  if (err) {
    throw err;
  }
}

describe("mongo persistence", function() {
  before(function(done) {
    MongoClient.connect(mongoCfg, function( error, db ){
      mongo = db;
      setTimeout(function() {
        done(error);
      }, 750);
    });
  });

  after(function(done) {
      setTimeout(function() {
        mongo.close(done);
      }, 750);
  });

  beforeEach(function(done) {
    mongo.collection('agendaJobs').remove({}, function(err) {
      failOnError(err);
      jobs.start();
      done();
    });
  });

  afterEach(function(done) {
    jobs.stop(done);
  });

  it("saves scheduled job to db", function(done) {
    jobs
      .create(jobType, {})
      .schedule('in 10 minutes')
      .save(function(err) {
        failOnError(err);

        mongo.collection('agendaJobs').find().toArray(function(err, arr) {
          failOnError(err);
          expect(arr).to.have.length(1);
          done();
        });
      });
  });

  it("clears jobs after completion", function(done) {
    jobs
      .create(jobType, {})
      .schedule('now')
      .save(function(err) {
        failOnError(err);

        mongo.collection('agendaJobs').find().toArray(function(err, arr) {
          failOnError(err);
          expect(arr).to.have.length(1);
        });

        jobs.on('complete', function() {
          mongo.collection('agendaJobs').find().toArray(function(err, arr) {
            failOnError(err);
            expect(arr).to.have.length(0);
            done();
          });
        });
      });
  });
});
