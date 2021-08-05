/* globals describe, it, beforeEach, afterEach */
"use strict";
const expect = require("expect.js");
const delay = require("delay");
const { MongoClient } = require("mongodb");
const { Agenda } = require("../dist");
const getMongoCfg = require("./fixtures/mongo-connector");

let mongoCfg;
const agendaDatabase = "agenda-test";

// Create agenda instances
let agenda = null;
let mongoDb = null;
let mongoClient = null;

const clearJobs = () => {
  return mongoDb.collection("agendaJobs").deleteMany({});
};

const jobType = "do work";
const jobProcessor = () => {};

describe("find-and-lock-next-job", () => {
  beforeEach(async () => {
    mongoCfg = await getMongoCfg(agendaDatabase);
  });

  beforeEach(async () => {
    jobs = new Agenda({
      db: {
        address: mongoCfg,
      },
    });

    await jobs._ready;

    mongoClient = await MongoClient.connect(mongoCfg);

    mongoDb = mongoClient.db(agendaDatabase);
    await delay(5);
    jobs.define("someJob", jobProcessor);
    jobs.define("send email", jobProcessor);
    jobs.define("some job", jobProcessor);
    jobs.define(jobType, jobProcessor);
  });

  afterEach(async () => {
    await delay(5);
    await agenda.stop();
    await clearJobs();
    await mongoClient.close();
    await agenda._db.close();
  });

  it.skip("should find jobs without lockedAt property", async () => {
    const collection = await mongoDb.collection("agendaJobs");
    const job = await agenda.create(jobType, {}).save();
    expect(job.attrs.lockedAt).to.equal(undefined);
    // The above line does not add `lockedAt` to DB. Nevertheless, let's delete it just in case.
    const { lastErrorObject } = await collection.findOneAndUpdate(
      { name: jobType },
      { $unset: { lockedAt: "" } }
    ); // deleting the property
    expect(lastErrorObject.updatedExisting).to.equal(true);
    const rawJob = await collection.findOne({ name: jobType });
    expect(rawJob.lockedAt).to.equal(undefined);
    expect(rawJob.nextRunAt.getTime()).to.be.lessThan(Date.now() + 1000);

    agenda.processEvery(100);
    let processed = 0;
    const successPromise = new Promise((resolve) => {
      processed += 1;
      agenda.on(`success:${jobType}`, resolve);
    });

    await agenda.start();
    await successPromise;

    expect(processed).to.equal(1);
  });

  it.skip("should find and rerun stuck jobs (with long ago lockedAt property)", async () => {
    const collection = await mongoDb.collection("agendaJobs");
    const job = await agenda.create(jobType, {}).save();
    expect(job.attrs.lockedAt).to.equal(undefined);
    // The above line does not add `lockedAt` to DB. The below simulates a stuck job.
    const { lastErrorObject } = await collection.findOneAndUpdate(
      { name: jobType },
      {
        $unset: { nextRunAt: "" },
        $set: {
          lockedAt: new Date(Date.now() - agenda._defaultLockLifetime - 1000),
        },
      }
    ); //
    expect(lastErrorObject.updatedExisting).to.equal(true);
    const rawJob = await collection.findOne({ name: jobType });
    expect(rawJob.nextRunAt).to.equal(undefined);
    expect(rawJob.lockedAt.getTime()).to.be.lessThan(
      Date.now() - agenda._defaultLockLifetime
    );

    agenda.processEvery(100);
    let processed = 0;
    const successPromise = new Promise((resolve) => {
      processed += 1;
      agenda.on(`success:${jobType}`, resolve);
    });

    await agenda.start();
    await successPromise;

    expect(processed).to.equal(1);
  });
});
