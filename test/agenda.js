/* globals describe, it, beforeEach, afterEach */
"use strict";
const expect = require("expect.js");
const { MongoClient } = require("mongodb");
const delay = require("delay");
const { Job } = require("../dist/job");
const { hasMongoProtocol } = require("../dist/agenda/has-mongo-protocol");
const { Agenda } = require("../dist");
const debug = require("debug")("agenda:test");

const getMongoCfg = require("./fixtures/mongo-connector");

let mongoCfg;
const agendaDatabase = "agenda-test";

// Create agenda instances
let jobs = null;
let mongoDb = null;
let mongoClient = null;

// Slow timeouts for CI
const jobTimeout = 500;
const jobType = "do work";
const jobProcessor = () => {};

describe("Agenda", () => {
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
    await jobs.stop();
    await jobs.cancel({});
    await mongoClient.close();
    await jobs._db.close();
  });

  it("sets a default processEvery", () => {
    expect(jobs._processEvery).to.be(5000);
  });

  describe("close", () => {
    it("closes database connection", async () => {
      const agenda2 = new Agenda(
        {
          db: {
            address: mongoCfg,
          },
        },
        async () => {
          // Inserting should still work
          const job = agenda2.create("some job", {
            wee: 1,
          });
          await job.save();
          expect(job.attrs._id).not.to.be(undefined);

          // Close connection
          await agenda2.close({ force: true });
          // Attemp to insert should fail now with correct message
          const job2 = agenda2.create("some job", {
            wee: 2,
          });
          try {
            await job2.save();
          } catch (error) {
            expect(error.message).to.be("server instance pool was destroyed");
          }
        }
      );
    });

    it("returns itself", () => {
      const agenda2 = new Agenda(
        {
          db: {
            address: mongoCfg,
          },
        },
        async () => {
          expect(await agenda2.close({ force: true })).to.be(agenda2);
        }
      );
    });
  });

  describe("configuration methods", () => {
    let agenda;
    it("sets the _db directly when passed as an option", async () => {
      agenda = new Agenda({ mongo: mongoDb });
      await agenda.start(); // ??
      expect(agenda._mdb.databaseName).to.equal(agendaDatabase);
    });

    afterEach(() => {
      agenda.stop();
    });
  });

  describe("configuration methods", () => {
    let mongoHost;
    beforeEach(() => {
       mongoHost =  process.env.MONGODB_HOST || "localhost"; 
    })

    describe("mongo connection tester", () => {
      it("passing a valid server connection string", () => {
        expect(hasMongoProtocol(mongoCfg)).to.equal(true);
      });

      it("passing a valid multiple server connection string", () => {
        expect(
          hasMongoProtocol("mongodb+srv://" + mongoHost + "/agenda-test")
        ).to.equal(true);
      });

      it("passing an invalid connection string", () => {
        expect(hasMongoProtocol(mongoHost + "/agenda-test")).to.equal(false);
      });
    });
    describe("mongo", () => {
      it("sets the _db directly", () => {
        const agenda = new Agenda();
        agenda.mongo(mongoDb);
        expect(agenda._mdb.databaseName).to.equal(agendaDatabase);
      });

      it("returns itself", () => {
        const agenda = new Agenda();
        expect(agenda.mongo(mongoDb)).to.be(agenda);
      });
    });

    describe("name", () => {
      it("sets the agenda name", () => {
        jobs.name("test queue");
        expect(jobs._name).to.be("test queue");
      });
      it("returns itself", () => {
        expect(jobs.name("test queue")).to.be(jobs);
      });
    });
    describe("processEvery", () => {
      it("sets the processEvery time", () => {
        jobs.processEvery("3 minutes");
        expect(jobs._processEvery).to.be(180000);
      });
      it("returns itself", () => {
        expect(jobs.processEvery("3 minutes")).to.be(jobs);
      });
    });
    describe("maxConcurrency", () => {
      it("sets the maxConcurrency", () => {
        jobs.maxConcurrency(10);
        expect(jobs._maxConcurrency).to.be(10);
      });
      it("returns itself", () => {
        expect(jobs.maxConcurrency(10)).to.be(jobs);
      });
    });
    describe("defaultConcurrency", () => {
      it("sets the defaultConcurrency", () => {
        jobs.defaultConcurrency(1);
        expect(jobs._defaultConcurrency).to.be(1);
      });
      it("returns itself", () => {
        expect(jobs.defaultConcurrency(5)).to.be(jobs);
      });
    });
    describe("lockLimit", () => {
      it("sets the lockLimit", () => {
        jobs.lockLimit(10);
        expect(jobs._lockLimit).to.be(10);
      });
      it("returns itself", () => {
        expect(jobs.lockLimit(10)).to.be(jobs);
      });
    });
    describe("defaultLockLimit", () => {
      it("sets the defaultLockLimit", () => {
        jobs.defaultLockLimit(1);
        expect(jobs._defaultLockLimit).to.be(1);
      });
      it("returns itself", () => {
        expect(jobs.defaultLockLimit(5)).to.be(jobs);
      });
    });
    describe("defaultLockLifetime", () => {
      it("returns itself", () => {
        expect(jobs.defaultLockLifetime(1000)).to.be(jobs);
      });
      it("sets the default lock lifetime", () => {
        jobs.defaultLockLifetime(9999);
        expect(jobs._defaultLockLifetime).to.be(9999);
      });
      it("is inherited by jobs", () => {
        jobs.defaultLockLifetime(7777);
        jobs.define("testDefaultLockLifetime", () => {});
        expect(jobs._definitions.testDefaultLockLifetime.lockLifetime).to.be(
          7777
        );
      });
    });
    describe("sort", () => {
      it("returns itself", () => {
        expect(jobs.sort({ nextRunAt: 1, priority: -1 })).to.be(jobs);
      });
      it("sets the default sort option", () => {
        jobs.sort({ nextRunAt: -1 });
        expect(jobs._sort).to.eql({ nextRunAt: -1 });
      });
    });
  });

  describe("job methods", () => {
    describe("create", () => {
      let job;
      beforeEach(() => {
        job = jobs.create("sendEmail", { to: "some guy" });
      });

      it("returns a job", () => {
        expect(job).to.be.a(Job);
      });
      it("sets the name", () => {
        expect(job.attrs.name).to.be("sendEmail");
      });
      it("sets the type", () => {
        expect(job.attrs.type).to.be("normal");
      });
      it("sets the agenda", () => {
        expect(job.agenda).to.be(jobs);
      });
      it("sets the data", () => {
        expect(job.attrs.data).to.have.property("to", "some guy");
      });
    });

    describe("define", () => {
      it("stores the definition for the job", () => {
        expect(jobs._definitions.someJob).to.have.property("fn", jobProcessor);
      });

      it("sets the default concurrency for the job", () => {
        expect(jobs._definitions.someJob).to.have.property("concurrency", 5);
      });

      it("sets the default lockLimit for the job", () => {
        expect(jobs._definitions.someJob).to.have.property("lockLimit", 0);
      });

      it("sets the default priority for the job", () => {
        expect(jobs._definitions.someJob).to.have.property("priority", 0);
      });
      it("takes concurrency option for the job", () => {
        jobs.define("highPriority", { priority: 10 }, jobProcessor);
        expect(jobs._definitions.highPriority).to.have.property("priority", 10);
      });
    });

    describe("every", () => {
      describe("with a job name specified", () => {
        it("returns a job", async () => {
          expect(await jobs.every("5 minutes", "send email")).to.be.a(Job);
        });
        it("cron job with month starting at 1", async () => {
          expect(
            await jobs
              .every("0 0 * 1 *", "send email")
              .then(({ attrs }) => attrs.nextRunAt.getMonth())
          ).to.be(0); // Javascript getMonth() return 0 for january
        });
        it("repeating job with cron", async () => {
          expect(
            await jobs
              .every("*/5 * * * *", "send email")
              .then(({ attrs }) => attrs.nextRunAt)
          ).to.not.be(null);
        });
        it("sets the repeatEvery", async () => {
          expect(
            await jobs
              .every("5 seconds", "send email")
              .then(({ attrs }) => attrs.repeatInterval)
          ).to.be("5 seconds");
        });
        it("sets the agenda", async () => {
          expect(
            await jobs
              .every("5 seconds", "send email")
              .then(({ agenda }) => agenda)
          ).to.be(jobs);
        });
        it("should update a job that was previously scheduled with `every`", async () => {
          await jobs.every(10, "shouldBeSingleJob");
          await delay(10);
          await jobs.every(20, "shouldBeSingleJob");

          // Give the saves a little time to propagate
          await delay(jobTimeout);

          const result = await jobs.jobs({ name: "shouldBeSingleJob" });
          expect(result).to.have.length(1);
        });
        it("should not run immediately if options.skipImmediate is true", async () => {
          const jobName = "send email";
          await jobs.every("5 minutes", jobName, {}, { skipImmediate: true });
          const matchingJobs = await jobs.jobs({ name: jobName });
          expect(matchingJobs).to.have.length(1);
          const job = matchingJobs[0];
          const nextRunAt = job.attrs.nextRunAt.getTime();
          const now = new Date().getTime();
          const diff = nextRunAt - now;
          expect(diff).to.be.greaterThan(0);
        });
        it("should run immediately if options.skipImmediate is false", async () => {
          const jobName = "send email";
          await jobs.every("5 minutes", jobName, {}, { skipImmediate: false });
          const job = (await jobs.jobs({ name: jobName }))[0];
          const nextRunAt = job.attrs.nextRunAt.getTime();
          const now = new Date().getTime();
          const diff = nextRunAt - now;
          expect(diff).to.be.lessThan(1);
        });
      });
      describe("with array of names specified", () => {
        it("returns array of jobs", async () => {
          expect(
            await jobs.every("5 minutes", ["send email", "some job"])
          ).to.be.an("array");
        });
      });
    });

    describe("schedule", () => {
      describe("with a job name specified", () => {
        it("returns a job", async () => {
          expect(await jobs.schedule("in 5 minutes", "send email")).to.be.a(
            Job
          );
        });
        it("sets the schedule", async () => {
          const fiveish = Date.now() + 250000;
          const scheduledJob = await jobs.schedule(
            "in 5 minutes",
            "send email"
          );
          expect(scheduledJob.attrs.nextRunAt.valueOf()).to.be.greaterThan(
            fiveish
          );
        });
      });
      describe("with array of names specified", () => {
        it("returns array of jobs", async () => {
          expect(
            await jobs.schedule("5 minutes", ["send email", "some job"])
          ).to.be.an("array");
        });
      });
    });

    describe("unique", () => {
      describe("should demonstrate unique contraint", () => {
        it("should modify one job when unique matches", async () => {
          const job1 = await jobs
            .create("unique job", {
              type: "active",
              userId: "123",
              other: true,
            })
            .unique({
              "data.type": "active",
              "data.userId": "123",
            })
            .schedule("now")
            .save();

          debug('Job 1 scheduled for ' + job1.attrs.nextRunAt.toISOString())
          await delay(10);

          const job2 = await jobs
            .create("unique job", {
              type: "active",
              userId: "123",
              other: false,
            })
            .unique({
              "data.type": "active",
              "data.userId": "123",
            })
            .schedule("now")
            .save();
            debug('Job 2 scheduled for ' + job2.attrs.nextRunAt.toISOString())

          // TODO: This test is currently failing, and I have to ask whether the test describes the expected behavior
          // since the 'insertOnly' flag is not set on the `unique` call
          expect(job1.attrs.nextRunAt.toISOString()).not.to.equal(
            job2.attrs.nextRunAt.toISOString()
          );

          mongoDb
            .collection("agendaJobs")
            .find({
              name: "unique job",
            })
            .toArray((error, jobs) => {
              if (error) {
                throw error;
              }

              expect(jobs).to.have.length(1);
            });
        });

        it("should not modify job when unique matches and insertOnly is set to true", async () => {
          const job1 = await jobs
            .create("unique job", {
              type: "active",
              userId: "123",
              other: true,
            })
            .unique(
              {
                "data.type": "active",
                "data.userId": "123",
              },
              {
                insertOnly: true,
              }
            )
            .schedule("now")
            .save();

          const job2 = await jobs
            .create("unique job", {
              type: "active",
              userId: "123",
              other: false,
            })
            .unique(
              {
                "data.type": "active",
                "data.userId": "123",
              },
              {
                insertOnly: true,
              }
            )
            .schedule("now")
            .save();

          expect(job1.attrs.nextRunAt.toISOString()).to.equal(
            job2.attrs.nextRunAt.toISOString()
          );

          mongoDb
            .collection("agendaJobs")
            .find({
              name: "unique job",
            })
            .toArray((error, jobs) => {
              if (error) {
                throw error;
              }

              expect(jobs).to.have.length(1);
            });
        });
      });

      describe("should demonstrate non-unique contraint", () => {
        it("should create two jobs when unique doesn't match", async () => {
          const time = new Date(Date.now() + 1000 * 60 * 3);
          const time2 = new Date(Date.now() + 1000 * 60 * 4);

          await jobs
            .create("unique job", {
              type: "active",
              userId: "123",
              other: true,
            })
            .unique({
              "data.type": "active",
              "data.userId": "123",
              nextRunAt: time,
            })
            .schedule(time)
            .save();

          await jobs
            .create("unique job", {
              type: "active",
              userId: "123",
              other: false,
            })
            .unique({
              "data.type": "active",
              "data.userId": "123",
              nextRunAt: time2,
            })
            .schedule(time)
            .save();

          mongoDb
            .collection("agendaJobs")
            .find({
              name: "unique job",
            })
            .toArray((error, jobs) => {
              if (error) {
                throw error;
              }

              expect(jobs).to.have.length(2);
            });
        });
      });
    });

    describe("now", () => {
      it("returns a job", async () => {
        expect(await jobs.now("send email")).to.be.a(Job);
      });
      it("sets the schedule", async () => {
        const now = Date.now();
        expect(
          await jobs
            .now("send email")
            .then(({ attrs }) => attrs.nextRunAt.valueOf())
        ).to.be.greaterThan(now - 1);
      });

      it("runs the job immediately", async () => {
        jobs.define("immediateJob", async (job) => {
          expect(job.isRunning()).to.be(true);
          await jobs.stop();
        });
        await jobs.now("immediateJob");
        await jobs.start();
      });
    });

    describe("jobs", () => {
      it("returns jobs", async () => {
        await jobs.create("test").save();
        jobs.jobs({}, async (error, c) => {
          if (error) {
            throw error;
          }

          expect(c.length).to.not.be(0);
          expect(c[0]).to.be.a(Job);
        });
      });
    });

    describe("purge", () => {
      it("removes all jobs without definitions", async () => {
        const job = jobs.create("no definition");
        await jobs.stop();
        await job.save();
        jobs.jobs(
          {
            name: "no definition",
          },
          async (error, j) => {
            if (error) {
              throw error;
            }

            expect(j).to.have.length(1);
            await jobs.purge();
            jobs.jobs(
              {
                name: "no definition",
              },
              (error, j) => {
                if (error) {
                  throw error;
                }

                expect(j).to.have.length(0);
              }
            );
          }
        );
      });
    });

    describe("saveJob", () => {
      it("persists job to the database", async () => {
        const job = jobs.create("someJob", {});
        await job.save();

        expect(job.attrs._id).to.be.ok();
      });
    });
  });

  describe("cancel", () => {
    beforeEach(async () => {
      let remaining = 3;
      const checkDone = () => {
        remaining--;
      };

      await jobs.create("jobA").save().then(checkDone);
      await jobs.create("jobA", "someData").save().then(checkDone);
      await jobs.create("jobB").save().then(checkDone);
      expect(remaining).to.be(0);
    });

    it("should cancel a job", async () => {
      const j = await jobs.jobs({ name: "jobA" });
      expect(j).to.have.length(2);

      await jobs.cancel({ name: "jobA" });
      const job = await jobs.jobs({ name: "jobA" });

      expect(job).to.have.length(0);
    });

    it("should cancel multiple jobs", async () => {
      const jobs1 = await jobs.jobs({ name: { $in: ["jobA", "jobB"] } });
      expect(jobs1).to.have.length(3);
      await jobs.cancel({ name: { $in: ["jobA", "jobB"] } });

      const jobs2 = await jobs.jobs({ name: { $in: ["jobA", "jobB"] } });
      expect(jobs2).to.have.length(0);
    });

    it("should cancel jobs only if the data matches", async () => {
      const jobs1 = await jobs.jobs({ name: "jobA", data: "someData" });
      expect(jobs1).to.have.length(1);
      await jobs.cancel({ name: "jobA", data: "someData" });

      const jobs2 = await jobs.jobs({ name: "jobA", data: "someData" });
      expect(jobs2).to.have.length(0);

      const jobs3 = await jobs.jobs({ name: "jobA" });
      expect(jobs3).to.have.length(1);
    });
  });

  describe("disable", () => {
    beforeEach(async () => {
      await Promise.all([
        jobs
          .create("sendEmail", { to: "some guy" })
          .schedule("1 minute")
          .save(),
        jobs
          .create("sendEmail", { from: "some guy" })
          .schedule("1 minute")
          .save(),
        jobs.create("some job").schedule("30 seconds").save(),
      ]);
    });

    it("disables all jobs", async () => {
      const ct = await jobs.disable({});

      expect(ct).to.be(3);
      const disabledJobs = await jobs.jobs({});

      expect(disabledJobs).to.have.length(3);
      disabledJobs.map((x) => expect(x.attrs.disabled).to.be(true));
    });

    it("disables jobs when queried by name", async () => {
      const ct = await jobs.disable({ name: "sendEmail" });

      expect(ct).to.be(2);
      const disabledJobs = await jobs.jobs({ name: "sendEmail" });

      expect(disabledJobs).to.have.length(2);
      disabledJobs.map((x) => expect(x.attrs.disabled).to.be(true));
    });

    it("disables jobs when queried by data", async () => {
      const ct = await jobs.disable({ "data.from": "some guy" });

      expect(ct).to.be(1);
      const disabledJobs = await jobs.jobs({
        "data.from": "some guy",
        disabled: true,
      });

      expect(disabledJobs).to.have.length(1);
    });

    it("does not modify `nextRunAt`", async () => {
      const js = await jobs.jobs({ name: "some job" });
      const ct = await jobs.disable({ name: "some job" });

      expect(ct).to.be(1);
      const disabledJobs = await jobs.jobs({
        name: "some job",
        disabled: true,
      });

      expect(disabledJobs[0].attrs.nextRunAt.toString()).to.be(
        js[0].attrs.nextRunAt.toString()
      );
    });
  });

  describe("enable", () => {
    beforeEach(async () => {
      await Promise.all([
        jobs
          .create("sendEmail", { to: "some guy" })
          .schedule("1 minute")
          .save(),
        jobs
          .create("sendEmail", { from: "some guy" })
          .schedule("1 minute")
          .save(),
        jobs.create("some job").schedule("30 seconds").save(),
      ]);
    });

    it("enables all jobs", async () => {
      const ct = await jobs.enable({});

      expect(ct).to.be(3);
      const enabledJobs = await jobs.jobs({});

      expect(enabledJobs).to.have.length(3);
      enabledJobs.map((x) => expect(x.attrs.disabled).to.be(false));
    });

    it("enables jobs when queried by name", async () => {
      const ct = await jobs.enable({ name: "sendEmail" });

      expect(ct).to.be(2);
      const enabledJobs = await jobs.jobs({ name: "sendEmail" });

      expect(enabledJobs).to.have.length(2);
      enabledJobs.map((x) => expect(x.attrs.disabled).to.be(false));
    });

    it("enables jobs when queried by data", async () => {
      const ct = await jobs.enable({ "data.from": "some guy" });

      expect(ct).to.be(1);
      const enabledJobs = await jobs.jobs({
        "data.from": "some guy",
        disabled: false,
      });

      expect(enabledJobs).to.have.length(1);
    });

    it("does not modify `nextRunAt`", async () => {
      const js = await jobs.jobs({ name: "some job" });
      const ct = await jobs.enable({ name: "some job" });

      expect(ct).to.be(1);
      const enabledJobs = await jobs.jobs({
        name: "some job",
        disabled: false,
      });

      expect(enabledJobs[0].attrs.nextRunAt.toString()).to.be(
        js[0].attrs.nextRunAt.toString()
      );
    });
  });

  describe("search", () => {
    beforeEach(async () => {
      await jobs.create("jobA", 1).save();
      await jobs.create("jobA", 2).save();
      await jobs.create("jobA", 3).save();
    });

    it("should limit jobs", async () => {
      const results = await jobs.jobs({ name: "jobA" }, {}, 2);
      expect(results).to.have.length(2);
    });

    it("should skip jobs", async () => {
      const results = await jobs.jobs({ name: "jobA" }, {}, 2, 2);
      expect(results).to.have.length(1);
    });

    it("should sort jobs", async () => {
      const results = await jobs.jobs({ name: "jobA" }, { data: -1 });

      expect(results).to.have.length(3);

      const job1 = results[0];
      const job2 = results[1];
      const job3 = results[2];

      expect(job1.attrs.data).to.be(3);
      expect(job2.attrs.data).to.be(2);
      expect(job3.attrs.data).to.be(1);
    });
  });

  describe("process jobs", () => {
    // eslint-disable-line prefer-arrow-callback
    it("should not cause unhandledRejection", async function () {
      // This unit tests if for this bug [https://github.com/agenda/agenda/issues/884]
      // which is not reproducible with default agenda config on shorter processEvery.
      // Thus we set the test timeout to 10000, and the delay below to 6000.
      this.timeout(10000);

      const unhandledRejections = [];
      const rejectionsHandler = (error) => unhandledRejections.push(error);
      process.on("unhandledRejection", rejectionsHandler);

      let j1processes = 0;
      jobs.define("j1", (job, done) => {
        j1processes += 1;
        done();
      });

      let j2processes = 0;
      jobs.define("j2", (job, done) => {
        j2processes += 1;
        done();
      });

      await jobs.start();
      await jobs.every("5 seconds", "j1");
      await jobs.every("10 seconds", "j2");

      await delay(6000);
      process.removeListener("unhandledRejection", rejectionsHandler);

      expect(j1processes).to.equal(2);
      expect(j2processes).to.equal(1);

      expect(unhandledRejections).to.have.length(0);
    });
  });
});
