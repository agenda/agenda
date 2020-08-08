/* globals describe, it, beforeEach, afterEach, before */
'use strict';
const delay = require('delay');
const {MongoClient} = require('mongodb');
const Agenda = require('..');
const mongoServer = require('./mongo-server');
const processEvery = require('../lib/agenda/process-every');

let mongoCfg;
beforeEach(() => {
  mongoCfg = mongoServer.getConnectionString();
});

const agendaDatabase = 'agenda-test';

// Create agenda instances
let agenda = null;
let mongoDb = null;
let mongoClient = null;

const jobType = 'do work';
const jobProcessor = () => {};

describe.only('Retry', () => {
  beforeEach(async () => {
    agenda = new Agenda({
      db: {
        address: mongoCfg
      },
      processEvery: 100,
    });

    await agenda.start();

    const client = await MongoClient.connect(mongoCfg);
   
    mongoClient = client;
    mongoDb = client.db(agendaDatabase);
     
    mongoDb = mongoClient.db(agendaDatabase);

    await delay(50);

    agenda.define('someJob', jobProcessor);
    agenda.define('send email', jobProcessor);
    agenda.define('some job', jobProcessor);
    agenda.define(jobType, jobProcessor);
  });

  afterEach(async() => {
    await delay(50);
    await agenda.stop();
    await mongoClient.close();
    await agenda._db.close();
  });

  it('should retry a job', async() => {
    let shouldFail = true;

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
