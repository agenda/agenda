/* globals describe, it, before */
'use strict';

const {MongoClient} = require('mongodb');
const delay = require('delay');
const expect = require('expect.js');

const Job = require('../lib/job');
const Agenda = require('..');
const mongoServer = require('./mongo-server');

let mongoCfg;
beforeEach(() => {
  mongoCfg = mongoServer.getConnectionString();
});

const JOB_NAME = 'dummyJob';

describe('MongoDB connection', () => {
  it('with useUnifiedTopology option', async() => {
    let client;
    let agenda;

    try {
      client = new MongoClient(mongoCfg, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });

      await client.connect();

      agenda = new Agenda({mongo: client.db()});

      await agenda.start();

      agenda.define(JOB_NAME, (job, done) => {
        done();
      });

      const job = new Job({agenda, name: JOB_NAME});

      const now = new Date();
      await delay(5);
      await job.run();

      expect(job.attrs.lastRunAt.valueOf()).to.be.greaterThan(now.valueOf());
    } catch (error) {
      throw error;
    } finally {
      await agenda.stop();
      await client.close();
    }
  });
});
