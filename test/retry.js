/* globals describe, it, beforeEach, afterEach */
'use strict';
const MongoClient = require('mongodb').MongoClient;
const Agenda = require('../index');

const mongoHost = process.env.MONGODB_HOST || 'localhost';
const mongoPort = process.env.MONGODB_PORT || '27017';
const agendaDatabase = 'agenda-test';
const mongoCfg = 'mongodb://' + mongoHost + ':' + mongoPort + '/' + agendaDatabase;

// Create agenda instances
let agenda = null;
let mongoDb = null;
let mongoClient = null;

const clearJobs = done => {
  mongoDb.collection('agendaJobs').deleteMany({}, done);
};

const jobType = 'do work';
const jobProcessor = () => {};

describe('Retry', () => {
  beforeEach(done => {
    agenda = new Agenda({
      db: {
        address: mongoCfg
      }
    }, err => {
      if (err) {
        done(err);
      }
      MongoClient.connect(mongoCfg, (error, client) => {
        mongoClient = client;
        mongoDb = client.db(agendaDatabase);
        setTimeout(() => {
          clearJobs(() => {
            agenda.define('someJob', jobProcessor);
            agenda.define('send email', jobProcessor);
            agenda.define('some job', jobProcessor);
            agenda.define(jobType, jobProcessor);
            done();
          });
        }, 50);
      });
    });
  });

  afterEach(async () => {
    await new Promise(resolve => setTimeout(resolve, 50));
    await agenda.stop();
    await clearJobs();
    await mongoClient.close();
    await agenda._db.close();
  });

  it('should retry a job', async () => {
    let shouldFail = true;

    agenda.processEvery(100); // Shave 5s off test runtime :grin:
    agenda.define('a job', (job, done) => {
      if (shouldFail) {
        shouldFail = false;
        return done(new Error('test failure'));
      }
      done();
    });

    agenda.on('fail:a job', (err, job) => {
      if (err) {
        // Do nothing as this is expected to fail.
      }
      job.schedule('now').save();
    });

    const successPromise = new Promise(resolve =>
      agenda.on('success:a job', resolve)
    );

    await agenda.now('a job');

    await agenda.start();
    await successPromise;
  });
});
