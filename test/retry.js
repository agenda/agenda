/* globals describe, it, beforeEach, afterEach */
'use strict';
const MongoClient = require('mongodb').MongoClient;
const Agenda = require('../index');

const mongoHost = process.env.MONGODB_HOST || 'localhost';
const mongoPort = process.env.MONGODB_PORT || '27017';
const mongoCfg = 'mongodb://' + mongoHost + ':' + mongoPort + '/agenda-test';

// Create agenda instances
let jobs = null;
let mongoDb = null;
let mongoClient = null;

const clearJobs = done => {
  mongoDb.collection('agendaJobs').removeMany({}, done);
};

const jobType = 'do work';
const jobProcessor = () => {};

describe('Retry', () => {
  beforeEach(done => {
    jobs = new Agenda({
      db: {
        address: mongoCfg
      }
    }, err => {
      if (err) {
        done(err);
      }
      MongoClient.connect(mongoCfg, (error, client) => {
        mongoClient = client;
        mongoDb = client.db('agenda-test');
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
          mongoClient.close(() => {
            if (jobs._db) jobs._db.close(done);
            else done();
          });
        });
      });
    }, 50);
  });

  it('should retry a job', done => {
    let shouldFail = true;
    jobs.define('a job', (job, done) => {
      if (shouldFail) {
        shouldFail = false;
        return done(new Error('test failure'));
      }
      done();
    });

    jobs.on('fail:a job', (err, job) => {
      if (err) {
        // Do nothing as this is expected to fail.
      }
      job.schedule('now').save();
    });

    jobs.on('success:a job', () => {
      jobs.stop();
      done();
    });

    jobs.now('a job');

    jobs.start();
  });
});
