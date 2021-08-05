/* globals describe, it, beforeEach, afterEach */
"use strict";
const delay = require("delay");
const { MongoClient } = require("mongodb");
const { Agenda } = require("../dist");
const getMongoCfg = require("./fixtures/mongo-connector");

let mongoCfg;

// Create agenda instances
let agenda = null;
let mongoClient = null;

const jobType = "do work";
const jobProcessor = () => {};

describe("Retry", () => {
  beforeEach(async () => {
    mongoCfg = await getMongoCfg();
  });

  beforeEach(async () => {
    agenda = new Agenda({
      db: {
        address: mongoCfg,
      },
      processEvery: 100,
    });

    await agenda.start();

    mongoClient = await MongoClient.connect(mongoCfg);

    await delay(5);

    agenda.define("someJob", jobProcessor);
    agenda.define("send email", jobProcessor);
    agenda.define("some job", jobProcessor);
    agenda.define(jobType, jobProcessor);
  });

  afterEach(async () => {
    await delay(5);
    await agenda.stop();
    await mongoClient.close();
    await agenda._db.close();
  });

  it("should retry a job", async () => {
    let shouldFail = true;

    agenda.define("a job", (job, done) => {
      if (shouldFail) {
        shouldFail = false;
        return done(new Error("test failure"));
      }

      done();
    });

    agenda.on("fail:a job", (error, job) => {
      if (error) {
        // Do nothing as this is expected to fail.
      }

      job.schedule("now").save();
    });

    const successPromise = new Promise((resolve) => {
      agenda.on("success:a job", resolve);
    });

    await agenda.now("a job");

    await agenda.start();
    await successPromise;
  });
});
