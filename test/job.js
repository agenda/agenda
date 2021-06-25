/* globals describe, it, beforeEach, afterEach */
"use strict";
const path = require("path");
const cp = require("child_process");
const expect = require("expect.js");
const moment = require("moment-timezone");
const { MongoClient } = require("mongodb");
const Q = require("q");
const delay = require("delay");
const sinon = require("sinon");
const { Job } = require("../dist/job");
const { Agenda } = require("../dist");

const mongoHost = process.env.MONGODB_HOST || "localhost";
const mongoPort = process.env.MONGODB_PORT || "27017";
const agendaDatabase = "agenda-test";
const mongoCfg =
  "mongodb://" + mongoHost + ":" + mongoPort + "/" + agendaDatabase;

// Create agenda instances
let agenda = null;
let mongoDb = null;
let mongoClient = null;

const clearJobs = () => {
  return mongoDb.collection("agendaJobs").deleteMany({});
};

// Slow timeouts for CI
const jobTimeout = 500;
const jobType = "do work";
const jobProcessor = () => {};

describe("Job", () => {
  beforeEach((done) => {
    agenda = new Agenda(
      {
        db: {
          address: mongoCfg,
        },
      },
      async (error) => {
        if (error) {
          done(error);
        }

        try {
          const client = await MongoClient.connect(mongoCfg, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
          });
          mongoClient = client;
          mongoDb = client.db(agendaDatabase);

          await delay(50);
          await clearJobs();

          agenda.define("someJob", jobProcessor);
          agenda.define("send email", jobProcessor);
          agenda.define("some job", jobProcessor);
          agenda.define(jobType, jobProcessor);
          done();
        } catch (error) {
          done(error);
        }
      }
    );
  });

  afterEach(async () => {
    await agenda.stop();
    await clearJobs();
    await mongoClient.close();
    await agenda._db.close();
  });

  describe("repeatAt", () => {
    const job = new Job();
    it("sets the repeat at", () => {
      job.repeatAt("3:30pm");
      expect(job.attrs.repeatAt).to.be("3:30pm");
    });
    it("returns the job", () => {
      expect(job.repeatAt("3:30pm")).to.be(job);
    });
  });

  describe("unique", () => {
    const job = new Job();
    it("sets the unique property", () => {
      job.unique({ "data.type": "active", "data.userId": "123" });
      expect(JSON.stringify(job.attrs.unique)).to.be(
        JSON.stringify({ "data.type": "active", "data.userId": "123" })
      );
    });
    it("returns the job", () => {
      expect(job.unique({ "data.type": "active", "data.userId": "123" })).to.be(
        job
      );
    });
  });

  describe("repeatEvery", () => {
    const job = new Job();
    it("sets the repeat interval", () => {
      job.repeatEvery(5000);
      expect(job.attrs.repeatInterval).to.be(5000);
    });
    it("returns the job", () => {
      expect(job.repeatEvery("one second")).to.be(job);
    });
    it("sets the nextRunAt property with skipImmediate", () => {
      const now = Date.now();
      const job2 = new Job();
      job2.repeatEvery("3 minutes", { skipImmediate: true });
      expect(job2.attrs.nextRunAt).to.be.within(now + 180000, now + 180003); // Inclusive
    });
    it("repeats from the existing nextRunAt property with skipImmediate", () => {
      const job2 = new Job();
      const futureDate = new Date("3000-01-01T00:00:00");
      job2.attrs.nextRunAt = futureDate;
      job2.repeatEvery("3 minutes", { skipImmediate: true });
      expect(job2.attrs.nextRunAt.getTime()).to.be(
        futureDate.getTime() + 180000
      );
    });
    it("repeats from the existing scheduled date with skipImmediate", () => {
      const futureDate = new Date("3000-01-01T00:00:00");
      const job2 = new Job().schedule(futureDate);
      job2.repeatEvery("3 minutes", { skipImmediate: true });
      expect(job2.attrs.nextRunAt.getTime()).to.be(
        futureDate.getTime() + 180000
      );
    });
  });

  describe("schedule", () => {
    let job;
    beforeEach(() => {
      job = new Job();
    });
    it("sets the next run time", () => {
      job.schedule("in 5 minutes");
      expect(job.attrs.nextRunAt).to.be.a(Date);
    });
    it("sets the next run time Date object", () => {
      const when = new Date(Date.now() + 1000 * 60 * 3);
      job.schedule(when);
      expect(job.attrs.nextRunAt).to.be.a(Date);
      expect(job.attrs.nextRunAt.getTime()).to.eql(when.getTime());
    });
    it("returns the job", () => {
      expect(job.schedule("tomorrow at noon")).to.be(job);
    });
    it("understands ISODates on the 30th", () => {
      // https://github.com/agenda/agenda/issues/807
      expect(
        job.schedule("2019-04-30T22:31:00.00Z").attrs.nextRunAt.getTime()
      ).to.equal(1556663460000);
    });
  });

  describe("priority", () => {
    let job;
    beforeEach(() => {
      job = new Job();
    });
    it("sets the priority to a number", () => {
      job.priority(10);
      expect(job.attrs.priority).to.be(10);
    });
    it("returns the job", () => {
      expect(job.priority(50)).to.be(job);
    });
    it("parses written priorities", () => {
      job.priority("high");
      expect(job.attrs.priority).to.be(10);
    });
  });

  describe("computeNextRunAt", () => {
    let job;

    beforeEach(() => {
      job = new Job();
    });

    it("returns the job", () => {
      expect(job.computeNextRunAt()).to.be(job);
    });

    it("sets to undefined if no repeat at", () => {
      job.attrs.repeatAt = null;
      job.computeNextRunAt();
      expect(job.attrs.nextRunAt).to.be(undefined);
    });

    it("it understands repeatAt times", () => {
      const d = new Date();
      d.setHours(23);
      d.setMinutes(59);
      d.setSeconds(0);
      job.attrs.repeatAt = "11:59pm";
      job.computeNextRunAt();
      expect(job.attrs.nextRunAt.getHours()).to.be(d.getHours());
      expect(job.attrs.nextRunAt.getMinutes()).to.be(d.getMinutes());
    });

    it("sets to undefined if no repeat interval", () => {
      job.attrs.repeatInterval = null;
      job.computeNextRunAt();
      expect(job.attrs.nextRunAt).to.be(undefined);
    });

    it("it understands human intervals", () => {
      const now = new Date();
      job.attrs.lastRunAt = now;
      job.repeatEvery("2 minutes");
      job.computeNextRunAt();
      expect(job.attrs.nextRunAt.getTime()).to.be(now.valueOf() + 120000);
    });

    it("understands cron intervals", () => {
      const now = new Date();
      now.setMinutes(1);
      now.setMilliseconds(0);
      now.setSeconds(0);
      job.attrs.lastRunAt = now;
      job.repeatEvery("*/2 * * * *");
      job.computeNextRunAt();
      expect(job.attrs.nextRunAt.getTime()).to.be(now.valueOf() + 60000);
    });

    it("understands cron intervals with a timezone", () => {
      const date = new Date("2015-01-01T06:01:00-00:00");
      job.attrs.lastRunAt = date;
      job.repeatEvery("0 6 * * *", {
        timezone: "GMT",
      });
      job.computeNextRunAt();
      expect(moment(job.attrs.nextRunAt).tz("GMT").hour()).to.be(6);
      expect(moment(job.attrs.nextRunAt).toDate().getDate()).to.be(
        moment(job.attrs.lastRunAt).add(1, "days").toDate().getDate()
      );
    });

    it("understands cron intervals with a timezone when last run is the same as the interval", () => {
      const date = new Date("2015-01-01T06:00:00-00:00");
      job.attrs.lastRunAt = date;
      job.repeatEvery("0 6 * * *", {
        timezone: "GMT",
      });
      job.computeNextRunAt();
      expect(moment(job.attrs.nextRunAt).tz("GMT").hour()).to.be(6);
      expect(moment(job.attrs.nextRunAt).toDate().getDate()).to.be(
        moment(job.attrs.lastRunAt).add(1, "days").toDate().getDate()
      );
    });

    describe("interval with startDate, endDate, skipDates", () => {
      it("sets interval with startDate in future", () => {
        const futureDate = moment().add(7, "days");
        const expectedFirstRunDate = moment().add(8, "days");
        expectedFirstRunDate.set({
          hour: 0,
          minute: 0,
          second: 0,
          millisecond: 0,
        });
        job.repeatEvery("0 0 * * *", {
          startDate: futureDate.toDate(),
        }); // Daily at midnight
        job.computeNextRunAt();
        expect(job.attrs.nextRunAt.getTime()).to.be(
          expectedFirstRunDate.toDate().getTime()
        );
      });

      it("sets interval with startDate in the past", () => {
        const futureDate = moment().add(-2, "days");
        const expectedFirstRunDate = moment().add(1, "days");
        expectedFirstRunDate.set({
          hour: 0,
          minute: 0,
          second: 0,
          millisecond: 0,
        });
        job.repeatEvery("0 0 * * *", {
          startDate: futureDate.toDate(),
        }); // Daily at midnight
        job.computeNextRunAt();
        expect(job.attrs.nextRunAt.getTime()).to.be(
          expectedFirstRunDate.toDate().getTime()
        );
      });

      it("sets interval with endDate that has past", () => {
        const futureDate = moment().add(7, "days");
        const lastRunDate = moment().add(2, "days");
        lastRunDate.set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
        job.repeatEvery("0 0 * * *", {
          endDate: lastRunDate.toDate(),
        }); // Daily at midnight
        job.attrs.lastRunAt = futureDate.toDate();
        job.computeNextRunAt();
        expect(job.attrs.nextRunAt).to.be(undefined);
      });

      it("sets interval with endDate that has *not* past", () => {
        const lastRunDate = moment().add(7, "days");
        job.repeatEvery("0 0 * * *", {
          endDate: lastRunDate.toDate(),
        }); // Daily at midnight
        job.computeNextRunAt();
        expect(job.attrs.nextRunAt).not.to.be(undefined);
      });

      it("sets interval with skip days", () => {
        const lastRun = moment().set({
          hour: 0,
          minute: 0,
          second: 0,
          millisecond: 0,
        });
        const expectedFirstRunDate = moment().add(4, "days");
        expectedFirstRunDate.set({
          hour: 0,
          minute: 0,
          second: 0,
          millisecond: 0,
        });
        job.repeatEvery("0 0 * * *", {
          skipDays: "3 days",
        }); // Daily at midnight
        job.attrs.lastRunAt = lastRun.toDate();
        job.computeNextRunAt();
        expect(job.attrs.nextRunAt.getTime()).to.be(
          expectedFirstRunDate.toDate().getTime()
        );
      });

      it("sets interval with endDate and skipDays", () => {
        const lastRun = moment().set({
          hour: 0,
          minute: 0,
          second: 0,
          millisecond: 0,
        });
        const lastRunDate = moment().add(1, "days");
        job.repeatEvery("0 0 * * *", {
          skipDays: "3 days",
          endDate: lastRunDate.toDate(),
        }); // Daily at midnight
        job.attrs.lastRunAt = lastRun.toDate();
        job.computeNextRunAt();
        expect(job.attrs.nextRunAt).to.be(undefined);
      });

      it("sets the correct interval when endDate is undefined", () => {
        // (Issue #1224): failed to calculate nextRunAt when endDate is undefined
        job.repeatEvery("0 0 * * *"); // Daily at midnight
        job.attrs.endDate = undefined;
        job.computeNextRunAt();
        expect(job.attrs.failCount).to.be(undefined);
        expect(job.attrs.nextRunAt).not.to.be(undefined);
      });
    });

    it("gives the correct nextDate when the lastRun is 1ms before the expected time", () => {
      // (Issue #858): lastRunAt being 1ms before the nextRunAt makes cronTime return the same nextRunAt
      const last = new Date();
      last.setSeconds(59);
      last.setMilliseconds(999);
      const next = new Date(last.valueOf() + 1);
      const expectedDate = new Date(next.valueOf() + 60000);
      job.attrs.lastRunAt = last;
      job.attrs.nextRunAt = next;
      job.repeatEvery("* * * * *", {
        timezone: "GMT",
      });
      job.computeNextRunAt();
      expect(job.attrs.nextRunAt.valueOf()).to.be(expectedDate.valueOf());
    });

    describe("when repeat at time is invalid", () => {
      beforeEach(() => {
        job.attrs.repeatAt = "foo";
        job.computeNextRunAt();
      });

      it("sets nextRunAt to undefined", () => {
        expect(job.attrs.nextRunAt).to.be(undefined);
      });

      it("fails the job", () => {
        expect(job.attrs.failReason).to.equal(
          "failed to calculate repeatAt time due to invalid format"
        );
      });
    });

    describe("when repeat interval is invalid", () => {
      beforeEach(() => {
        job.attrs.repeatInterval = "asd";
        job.computeNextRunAt();
      });

      it("sets nextRunAt to undefined", () => {
        expect(job.attrs.nextRunAt).to.be(undefined);
      });

      it("fails the job", () => {
        expect(job.attrs.failReason).to.equal(
          "failed to calculate nextRunAt due to invalid repeat interval"
        );
      });
    });
  });

  describe("remove", () => {
    it("removes the job", async () => {
      const job = new Job({
        agenda,
        name: "removed job",
      });
      await job.save();
      await job.remove();

      const result = await mongoDb
        .collection("agendaJobs")
        .find({
          _id: job.attrs._id,
        })
        .toArray();

      expect(result).to.have.length(0);
    });
  });

  describe("run", () => {
    let job;

    beforeEach(() => {
      agenda.define("testRun", (job, done) => {
        setTimeout(() => {
          done();
        }, 100);
      });

      job = new Job({ agenda, name: "testRun" });
    });

    it("updates lastRunAt", async () => {
      const now = new Date();
      await delay(5);
      await job.run();

      expect(job.attrs.lastRunAt.valueOf()).to.be.greaterThan(now.valueOf());
    });

    it("fails if job is undefined", async () => {
      job = new Job({ agenda, name: "not defined" });
      await job.run().catch((error) => {
        expect(error.message).to.be("Undefined job");
      });
      expect(job.attrs.failedAt).to.be.ok();
      expect(job.attrs.failReason).to.be("Undefined job");
    });

    it("updates nextRunAt", async () => {
      const now = new Date();
      job.repeatEvery("10 minutes");
      await delay(5);
      await job.run();
      expect(job.attrs.nextRunAt.valueOf()).to.be.greaterThan(
        now.valueOf() + 59999
      );
    });

    it("handles errors", async () => {
      job.attrs.name = "failBoat";
      agenda.define("failBoat", () => {
        throw new Error("Zomg fail");
      });
      await job.run();
      expect(job.attrs.failReason).to.be("Zomg fail");
    });

    it("handles errors with q promises", async () => {
      job.attrs.name = "failBoat2";
      agenda.define("failBoat2", (job, cb) => {
        Q.delay(100)
          .then(() => {
            // eslint-disable-line
            throw new Error("Zomg fail");
          })
          .fail(cb)
          .done();
      });
      await job.run();
      expect(job.attrs.failReason).to.be.ok();
    });

    it("allows async functions", async () => {
      job.attrs.name = "async";

      const successSpy = sinon.stub();
      let finished = false;

      agenda.once("success:async", successSpy);

      agenda.define("async", async () => {
        await delay(5);
        finished = true;
      });

      expect(finished).to.equal(false);
      await job.run();
      expect(successSpy.callCount).to.equal(1);
      expect(finished).to.equal(true);
    });

    it("handles errors from async functions", async () => {
      job.attrs.name = "asyncFail";

      const failSpy = sinon.stub();
      const error = new Error("failure");

      agenda.once("fail:asyncFail", failSpy);

      agenda.define("asyncFail", async () => {
        await delay(5);
        throw error;
      });

      await job.run();
      expect(failSpy.callCount).to.equal(1);
      expect(failSpy.calledWith(error)).to.equal(true);
    });

    it("waits for the callback to be called even if the function is async", async () => {
      job.attrs.name = "asyncCb";

      const successSpy = sinon.stub();
      let finishedCb = false;

      agenda.once("success:asyncCb", successSpy);

      agenda.define("asyncCb", async (job, cb) => {
        (async () => {
          await delay(5);
          finishedCb = true;
          cb();
        })();
      });

      await job.run();
      expect(finishedCb).to.equal(true);
      expect(successSpy.callCount).to.equal(1);
    });

    it("uses the callback error if the function is async and didn't reject", async () => {
      job.attrs.name = "asyncCbError";

      const failSpy = sinon.stub();
      const error = new Error("failure");

      agenda.once("fail:asyncCbError", failSpy);

      agenda.define("asyncCbError", async (job, cb) => {
        (async () => {
          await delay(5);
          cb(error);
        })();
      });

      await job.run();
      expect(failSpy.callCount).to.equal(1);
      expect(failSpy.calledWith(error)).to.equal(true);
    });

    it("favors the async function error over the callback error if it comes first", async () => {
      job.attrs.name = "asyncCbTwoError";

      const failSpy = sinon.stub();
      const fnError = new Error("functionFailure");
      const cbError = new Error("callbackFailure");

      agenda.on("fail:asyncCbTwoError", failSpy);

      agenda.define("asyncCbTwoError", async (job, cb) => {
        (async () => {
          await delay(5);
          cb(cbError);
        })();

        throw fnError;
      });

      await job.run();
      expect(failSpy.callCount).to.equal(1);
      expect(failSpy.calledWith(fnError)).to.equal(true);
      expect(failSpy.calledWith(cbError)).to.equal(false);
    });

    it("favors the callback error over the async function error if it comes first", async () => {
      job.attrs.name = "asyncCbTwoErrorCb";

      const failSpy = sinon.stub();
      const fnError = new Error("functionFailure");
      const cbError = new Error("callbackFailure");

      agenda.on("fail:asyncCbTwoErrorCb", failSpy);

      agenda.define("asyncCbTwoErrorCb", async (job, cb) => {
        cb(cbError);
        await delay(5);
        throw fnError;
      });

      await job.run();
      expect(failSpy.callCount).to.equal(1);
      expect(failSpy.calledWith(cbError)).to.equal(true);
      expect(failSpy.calledWith(fnError)).to.equal(false);
    });

    it("doesn't allow a stale job to be saved", async () => {
      job.attrs.name = "failBoat3";
      await job.save();
      agenda.define("failBoat3", async (job, cb) => {
        // Explicitly find the job again,
        // so we have a new job object
        const jobs = await agenda.jobs({ name: "failBoat3" });
        expect(jobs).to.have.length(1);
        await jobs[0].remove();
        cb();
      });

      await job.run();

      // Expect the deleted job to not exist in the database
      const deletedJob = await agenda.jobs({ name: "failBoat3" });
      expect(deletedJob).to.have.length(0);
    });
  });

  describe("touch", () => {
    it("extends the lock lifetime", async () => {
      const lockedAt = new Date();
      const job = new Job({ agenda, name: "some job", lockedAt });
      await delay(2);
      await job.touch();
      expect(job.attrs.lockedAt).to.be.greaterThan(lockedAt);
    });
  });

  describe("fail", () => {
    const job = new Job();
    it("takes a string", () => {
      job.fail("test");
      expect(job.attrs.failReason).to.be("test");
    });
    it("takes an error object", () => {
      job.fail(new Error("test"));
      expect(job.attrs.failReason).to.be("test");
    });
    it("sets the failedAt time", () => {
      job.fail("test");
      expect(job.attrs.failedAt).to.be.a(Date);
    });
    it("sets the failedAt time equal to lastFinishedAt time", () => {
      job.fail("test");
      expect(job.attrs.failedAt).to.be.equal(job.attrs.lastFinishedAt);
    });
  });

  describe("enable", () => {
    it("sets disabled to false on the job", () => {
      const job = new Job({ disabled: true });
      job.enable();
      expect(job.attrs.disabled).to.be(false);
    });

    it("returns the job", () => {
      const job = new Job({ disabled: true });
      expect(job.enable()).to.be(job);
    });
  });

  describe("disable", () => {
    it("sets disabled to true on the job", () => {
      const job = new Job();
      job.disable();
      expect(job.attrs.disabled).to.be(true);
    });
    it("returns the job", () => {
      const job = new Job();
      expect(job.disable()).to.be(job);
    });
  });

  describe("save", () => {
    it("calls saveJob on the agenda", (done) => {
      const oldSaveJob = agenda.saveJob;
      agenda.saveJob = () => {
        agenda.saveJob = oldSaveJob;
        done();
      };

      const job = agenda.create("some job", {
        wee: 1,
      });
      job.save();
    });

    it("doesnt save the job if its been removed", async () => {
      const job = agenda.create("another job");
      // Save, then remove, then try and save again.
      // The second save should fail.
      const j = await job.save();
      await j.remove();
      await j.save();

      const jobs = await agenda.jobs({ name: "another job" });
      expect(jobs).to.have.length(0);
    });

    it("returns the job", async () => {
      const job = agenda.create("some job", {
        wee: 1,
      });
      expect(await job.save()).to.be(job);
    });
  });

  describe("start/stop", () => {
    it("starts/stops the job queue", async () => {
      // @TODO: this lint issue should be looked into: https://eslint.org/docs/rules/no-async-promise-executor
      // eslint-disable-next-line no-async-promise-executor
      return new Promise(async (resolve) => {
        agenda.define("jobQueueTest", async (job, cb) => {
          await agenda.stop();
          await clearJobs();
          cb();
          agenda.define("jobQueueTest", (job, cb) => {
            cb();
          });
          resolve();
        });
        await agenda.every("1 second", "jobQueueTest");
        agenda.processEvery("1 second");
        await agenda.start();
      });
    });

    it("does not run disabled jobs", async () => {
      let ran = false;
      agenda.define("disabledJob", () => {
        ran = true;
      });

      const job = await agenda.create("disabledJob").disable().schedule("now");
      await job.save();
      await agenda.start();
      await delay(jobTimeout);

      expect(ran).to.be(false);

      await agenda.stop();
    });

    it("does not throw an error trying to process undefined jobs", async () => {
      await agenda.start();
      const job = agenda.create("jobDefinedOnAnotherServer").schedule("now");

      await job.save();

      await delay(jobTimeout);
      await agenda.stop();
    });

    it("clears locks on stop", async () => {
      agenda.define("longRunningJob", (job, cb) => {
        // eslint-disable-line no-unused-vars
        // Job never finishes (the 2nd parameter is important, otherwise the job finishes immediately)
      });
      agenda.every("10 seconds", "longRunningJob");
      agenda.processEvery("1 second");

      await agenda.start();
      await delay(jobTimeout);
      await agenda.stop();
      const job = await agenda._collection.findOne({ name: "longRunningJob" });
      expect(job.lockedAt).to.be(null);
    });

    describe("events", () => {
      beforeEach(() => {
        agenda.define("jobQueueTest", (job, cb) => {
          cb();
        });
        agenda.define("failBoat", () => {
          throw new Error("Zomg fail");
        });
      });

      it("emits start event", async () => {
        const spy = sinon.spy();
        const job = new Job({ agenda, name: "jobQueueTest" });
        agenda.once("start", spy);

        await job.run();
        expect(spy.called).to.be(true);
        expect(spy.calledWithExactly(job)).to.be(true);
      });

      it("emits start:job name event", async () => {
        const spy = sinon.spy();
        const job = new Job({ agenda, name: "jobQueueTest" });
        agenda.once("start:jobQueueTest", spy);

        await job.run();
        expect(spy.called).to.be(true);
        expect(spy.calledWithExactly(job)).to.be(true);
      });

      it("emits complete event", async () => {
        const spy = sinon.spy();
        const job = new Job({ agenda, name: "jobQueueTest" });
        agenda.once("complete", spy);

        await job.run();
        expect(spy.called).to.be(true);
        expect(spy.calledWithExactly(job)).to.be(true);
      });

      it("emits complete:job name event", async () => {
        const spy = sinon.spy();
        const job = new Job({ agenda, name: "jobQueueTest" });
        agenda.once("complete:jobQueueTest", spy);

        await job.run();
        expect(spy.called).to.be(true);
        expect(spy.calledWithExactly(job)).to.be(true);
      });

      it("emits success event", async () => {
        const spy = sinon.spy();
        const job = new Job({ agenda, name: "jobQueueTest" });
        agenda.once("success", spy);

        await job.run();
        expect(spy.called).to.be(true);
        expect(spy.calledWithExactly(job)).to.be(true);
      });

      it("emits success:job name event", async () => {
        const spy = sinon.spy();
        const job = new Job({ agenda, name: "jobQueueTest" });
        agenda.once("success:jobQueueTest", spy);

        await job.run();
        expect(spy.called).to.be(true);
        expect(spy.calledWithExactly(job)).to.be(true);
      });

      it("emits fail event", async () => {
        const spy = sinon.spy();
        const job = new Job({ agenda, name: "failBoat" });
        agenda.once("fail", spy);

        await job.run().catch((error) => {
          expect(error.message).to.be("Zomg fail");
        });

        expect(spy.called).to.be(true);

        const error = spy.args[0][0];
        expect(error.message).to.be("Zomg fail");
        expect(job.attrs.failCount).to.be(1);
        expect(job.attrs.failedAt.valueOf()).not.to.be.below(
          job.attrs.lastFinishedAt.valueOf()
        );
      });

      it("emits fail:job name event", async () => {
        const spy = sinon.spy();
        const job = new Job({ agenda, name: "failBoat" });
        agenda.once("fail:failBoat", spy);

        await job.run().catch((error) => {
          expect(error.message).to.be("Zomg fail");
        });

        expect(spy.called).to.be(true);

        const error = spy.args[0][0];
        expect(error.message).to.be("Zomg fail");
        expect(job.attrs.failCount).to.be(1);
        expect(job.attrs.failedAt.valueOf()).not.to.be.below(
          job.attrs.lastFinishedAt.valueOf()
        );
      });
    });
  });

  describe("job lock", () => {
    it("runs a recurring job after a lock has expired", async () => {
      let startCounter = 0;

      const processorPromise = new Promise((resolve) => {
        agenda.define("lock job", { lockLifetime: 50 }, async () => {
          startCounter++;

          if (startCounter !== 1) {
            expect(startCounter).to.be(2);
            await agenda.stop();
            resolve();
          }
        });
      });

      expect(agenda._definitions["lock job"].lockLifetime).to.be(50);

      agenda.defaultConcurrency(100);
      agenda.processEvery(10);
      agenda.every("0.02 seconds", "lock job");
      await agenda.stop();
      await agenda.start();
      await processorPromise;
    });

    it("runs a one-time job after its lock expires", async () => {
      let runCount = 0;

      const processorPromise = new Promise((resolve) => {
        agenda.define("lock job", { lockLifetime: 50 }, async (job, cb) => {
          // eslint-disable-line no-unused-vars
          runCount++;

          if (runCount !== 1) {
            expect(runCount).to.be(2);
            await agenda.stop();
            resolve();
          }
        });
      });

      agenda.processEvery(50);
      await agenda.start();
      agenda.now("lock job", {
        i: 1,
      });
      await processorPromise;
    });

    it("does not process locked jobs", async () => {
      const history = [];

      agenda.define(
        "lock job",
        {
          lockLifetime: 300,
        },
        (job, cb) => {
          history.push(job.attrs.data.i);

          setTimeout(() => {
            cb();
          }, 150);
        }
      );

      agenda.processEvery(100);
      await agenda.start();

      await Promise.all([
        agenda.now("lock job", { i: 1 }),
        agenda.now("lock job", { i: 2 }),
        agenda.now("lock job", { i: 3 }),
      ]);

      await delay(500);
      expect(history).to.have.length(3);
      expect(history).to.contain(1);
      expect(history).to.contain(2);
      expect(history).to.contain(3);
    });

    it("does not on-the-fly lock more than agenda._lockLimit jobs", async () => {
      agenda.lockLimit(1);

      agenda.define("lock job", (job, cb) => {}); // eslint-disable-line no-unused-vars

      await agenda.start();

      await Promise.all([
        agenda.now("lock job", { i: 1 }),
        agenda.now("lock job", { i: 2 }),
      ]);

      await delay(500);
      expect(agenda._lockedJobs).to.have.length(1);
      await agenda.stop();
    });

    it("does not on-the-fly lock more mixed jobs than agenda._lockLimit jobs", async () => {
      agenda.lockLimit(1);

      agenda.define("lock job", (job, cb) => {}); // eslint-disable-line no-unused-vars
      agenda.define("lock job2", (job, cb) => {}); // eslint-disable-line no-unused-vars
      agenda.define("lock job3", (job, cb) => {}); // eslint-disable-line no-unused-vars
      agenda.define("lock job4", (job, cb) => {}); // eslint-disable-line no-unused-vars
      agenda.define("lock job5", (job, cb) => {}); // eslint-disable-line no-unused-vars

      await agenda.start();

      await Promise.all([
        agenda.now("lock job", { i: 1 }),
        agenda.now("lock job5", { i: 2 }),
        agenda.now("lock job4", { i: 3 }),
        agenda.now("lock job3", { i: 4 }),
        agenda.now("lock job2", { i: 5 }),
      ]);

      await delay(500);
      expect(agenda._lockedJobs).to.have.length(1);
      await agenda.stop();
    });

    it("does not on-the-fly lock more than definition.lockLimit jobs", async () => {
      agenda.define("lock job", { lockLimit: 1 }, (job, cb) => {}); // eslint-disable-line no-unused-vars

      await agenda.start();

      await Promise.all([
        agenda.now("lock job", { i: 1 }),
        agenda.now("lock job", { i: 2 }),
      ]);

      await delay(500);
      expect(agenda._lockedJobs).to.have.length(1);
      await agenda.stop();
    });

    it("does not lock more than agenda._lockLimit jobs during processing interval", async () => {
      agenda.lockLimit(1);
      agenda.processEvery(200);

      agenda.define("lock job", (job, cb) => {}); // eslint-disable-line no-unused-vars

      await agenda.start();

      const when = moment().add(300, "ms").toDate();

      await Promise.all([
        agenda.schedule(when, "lock job", { i: 1 }),
        agenda.schedule(when, "lock job", { i: 2 }),
      ]);

      await delay(500);
      expect(agenda._lockedJobs).to.have.length(1);
      await agenda.stop();
    });

    it("does not lock more than definition.lockLimit jobs during processing interval", async () => {
      agenda.processEvery(200);

      agenda.define("lock job", { lockLimit: 1 }, (job, cb) => {}); // eslint-disable-line no-unused-vars

      await agenda.start();

      const when = moment().add(300, "ms").toDate();

      await Promise.all([
        agenda.schedule(when, "lock job", { i: 1 }),
        agenda.schedule(when, "lock job", { i: 2 }),
      ]);

      await delay(500);
      expect(agenda._lockedJobs).to.have.length(1);
      await agenda.stop();
    });
  });

  describe("job concurrency", () => {
    it("should not block a job for concurrency of another job", async () => {
      agenda.processEvery(50);

      const processed = [];
      const now = Date.now();

      agenda.define(
        "blocking",
        {
          concurrency: 1,
        },
        (job, cb) => {
          processed.push(job.attrs.data.i);
          setTimeout(cb, 400);
        }
      );

      agenda.define(
        "non-blocking",
        {
          // Lower priority to keep it at the back in the queue
          priority: "lowest",
        },
        (job) => {
          processed.push(job.attrs.data.i);
          expect(processed).not.to.contain(2);
        }
      );

      let finished = false;
      agenda.on("complete", () => {
        if (!finished && processed.length === 3) {
          finished = true;
        }
      });

      agenda.start();

      return Promise.all([
        agenda.schedule(new Date(now + 100), "blocking", { i: 1 }),
        agenda.schedule(new Date(now + 100), "blocking", { i: 2 }),
        agenda.schedule(new Date(now + 100), "non-blocking", { i: 3 }),
      ]);
    });

    it("should run jobs as first in first out (FIFO)", async () => {
      const results = [];

      agenda.processEvery(100);
      agenda.define("fifo", { concurrency: 1 }, (job, cb) => cb());

      const checkResultsPromise = new Promise((resolve) => {
        agenda.on("start:fifo", (job) => {
          results.push(new Date(job.attrs.nextRunAt).getTime());
          if (results.length !== 3) {
            return;
          }

          expect(results.join("")).to.eql(results.sort().join(""));
          resolve();
        });
      });

      await agenda.start();

      await agenda.now("fifo");
      await delay(50);
      await agenda.now("fifo");
      await delay(50);
      await agenda.now("fifo");
      await delay(50);
      await checkResultsPromise;
    });

    it("should run jobs as first in first out (FIFO) with respect to priority", async () => {
      const times = [];
      const priorities = [];
      const now = Date.now();

      agenda.define("fifo-priority", { concurrency: 1 }, (job, cb) => cb());

      const checkResultsPromise = new Promise((resolve) => {
        agenda.on("start:fifo-priority", (job) => {
          priorities.push(job.attrs.priority);
          times.push(new Date(job.attrs.lastRunAt).getTime());
          if (priorities.length !== 3 || times.length !== 3) {
            return;
          }

          expect(times.join("")).to.eql(times.sort().join(""));
          expect(priorities).to.eql([10, 10, -10]);
          resolve();
        });
      });

      await Promise.all([
        agenda
          .create("fifo-priority", { i: 1 })
          .schedule(new Date(now))
          .priority("high")
          .save(),
        agenda
          .create("fifo-priority", { i: 2 })
          .schedule(new Date(now + 100))
          .priority("low")
          .save(),
        agenda
          .create("fifo-priority", { i: 3 })
          .schedule(new Date(now + 100))
          .priority("high")
          .save(),
      ]);
      await agenda.start();
      await checkResultsPromise;
    });

    it("should run higher priority jobs first", async () => {
      // Inspired by tests added by @lushc here:
      // <https://github.com/agenda/agenda/pull/451/commits/336ff6445803606a6dc468a6f26c637145790adc>
      const now = new Date();
      const results = [];

      agenda.define("priority", { concurrency: 1 }, (job, cb) => cb());

      const checkResultsPromise = new Promise((resolve) => {
        agenda.on("start:priority", (job) => {
          results.push(job.attrs.priority);
          if (results.length !== 3) {
            return;
          }

          expect(results).to.eql([10, 0, -10]);
          resolve();
        });
      });

      await Promise.all([
        agenda.create("priority").schedule(now).save(),
        agenda.create("priority").schedule(now).priority("low").save(),
        agenda.create("priority").schedule(now).priority("high").save(),
      ]);
      await agenda.start();
      await checkResultsPromise;
    });

    it("should support custom sort option", () => {
      const sort = { foo: 1 };
      const agenda = new Agenda({ sort });
      expect(agenda._sort).to.eql(sort);
    });
  });

  describe("every running", () => {
    beforeEach(async () => {
      agenda.defaultConcurrency(1);
      agenda.processEvery(5);

      await agenda.stop();
    });

    it("should run the same job multiple times", async () => {
      let counter = 0;

      agenda.define("everyRunTest1", (job, cb) => {
        if (counter < 2) {
          counter++;
        }

        cb();
      });

      await agenda.every(10, "everyRunTest1");

      await agenda.start();

      await agenda.jobs({ name: "everyRunTest1" });
      await delay(jobTimeout);
      expect(counter).to.be(2);

      await agenda.stop();
    });

    it("should reuse the same job on multiple runs", async () => {
      let counter = 0;

      agenda.define("everyRunTest2", (job, cb) => {
        if (counter < 2) {
          counter++;
        }

        cb();
      });
      await agenda.every(10, "everyRunTest2");

      await agenda.start();

      await delay(jobTimeout);
      const result = await agenda.jobs({ name: "everyRunTest2" });

      expect(result).to.have.length(1);
      await agenda.stop();
    });
  });

  describe("Integration Tests", () => {
    describe(".every()", () => {
      it("Should not rerun completed jobs after restart", (done) => {
        let i = 0;

        const serviceError = function (error) {
          done(error);
        };

        const receiveMessage = function (message) {
          if (message === "ran") {
            expect(i).to.be(0);
            i += 1;
            startService();
          } else if (message === "notRan") {
            expect(i).to.be(1);
            done();
          } else {
            return done(new Error("Unexpected response returned!"));
          }
        };

        const startService = () => {
          const serverPath = path.join(
            __dirname,
            "fixtures",
            "agenda-instance.js"
          );
          const n = cp.fork(serverPath, [mongoCfg, "daily"]);

          n.on("message", receiveMessage);
          n.on("error", serviceError);
        };

        startService();
      });

      it("Should properly run jobs when defined via an array", (done) => {
        const serverPath = path.join(
          __dirname,
          "fixtures",
          "agenda-instance.js"
        );
        const n = cp.fork(serverPath, [mongoCfg, "daily-array"]);

        let ran1 = false;
        let ran2 = false;
        let doneCalled = false;

        const serviceError = function (error) {
          done(error);
        };

        const receiveMessage = function (message) {
          if (message === "test1-ran") {
            ran1 = true;
            if (ran1 && ran2 && !doneCalled) {
              doneCalled = true;
              done();
              return n.send("exit");
            }
          } else if (message === "test2-ran") {
            ran2 = true;
            if (ran1 && ran2 && !doneCalled) {
              doneCalled = true;
              done();
              return n.send("exit");
            }
          } else {
            return done(new Error("Jobs did not run!"));
          }
        };

        n.on("message", receiveMessage);
        n.on("error", serviceError);
      });

      it("should not run if job is disabled", async () => {
        let counter = 0;

        agenda.define("everyDisabledTest", (job, cb) => {
          counter++;
          cb();
        });

        const job = await agenda.every(10, "everyDisabledTest");

        job.disable();

        await job.save();
        await agenda.start();

        await delay(jobTimeout);
        await agenda.jobs({ name: "everyDisabledTest" });
        expect(counter).to.be(0);
        await agenda.stop();
      });
    });

    describe("schedule()", () => {
      it("Should not run jobs scheduled in the future", (done) => {
        let i = 0;

        const serviceError = function (error) {
          done(error);
        };

        const receiveMessage = function (message) {
          if (message === "notRan") {
            if (i < 5) {
              return done();
            }

            i += 1;
            startService();
          } else {
            return done(new Error("Job scheduled in future was ran!"));
          }
        };

        const startService = () => {
          const serverPath = path.join(
            __dirname,
            "fixtures",
            "agenda-instance.js"
          );
          const n = cp.fork(serverPath, [mongoCfg, "define-future-job"]);

          n.on("message", receiveMessage);
          n.on("error", serviceError);
        };

        startService();
      });

      it("Should run past due jobs when process starts", (done) => {
        const serviceError = function (error) {
          done(error);
        };

        const receiveMessage = function (message) {
          if (message === "ran") {
            done();
          } else {
            return done(new Error("Past due job did not run!"));
          }
        };

        const startService = () => {
          const serverPath = path.join(
            __dirname,
            "fixtures",
            "agenda-instance.js"
          );
          const n = cp.fork(serverPath, [mongoCfg, "define-past-due-job"]);

          n.on("message", receiveMessage);
          n.on("error", serviceError);
        };

        startService();
      });

      it("Should schedule using array of names", (done) => {
        const serverPath = path.join(
          __dirname,
          "fixtures",
          "agenda-instance.js"
        );
        const n = cp.fork(serverPath, [mongoCfg, "schedule-array"]);

        let ran1 = false;
        let ran2 = false;
        let doneCalled = false;

        const serviceError = (error) => {
          done(error);
        };

        const receiveMessage = (message) => {
          if (message === "test1-ran") {
            ran1 = true;
            if (ran1 && ran2 && !doneCalled) {
              doneCalled = true;
              done();
              return n.send("exit");
            }
          } else if (message === "test2-ran") {
            ran2 = true;
            if (ran1 && ran2 && !doneCalled) {
              doneCalled = true;
              done();
              return n.send("exit");
            }
          } else {
            return done(new Error("Jobs did not run!"));
          }
        };

        n.on("message", receiveMessage);
        n.on("error", serviceError);
      });
    });

    describe("now()", () => {
      it("Should immediately run the job", (done) => {
        const serviceError = function (error) {
          done(error);
        };

        const receiveMessage = function (message) {
          if (message === "ran") {
            return done();
          }

          return done(new Error("Job did not immediately run!"));
        };

        const serverPath = path.join(
          __dirname,
          "fixtures",
          "agenda-instance.js"
        );
        const n = cp.fork(serverPath, [mongoCfg, "now"]);

        n.on("message", receiveMessage);
        n.on("error", serviceError);
      });
    });

    describe("General Integration", () => {
      it("Should not run a job that has already been run", async () => {
        const runCount = {};

        agenda.define("test-job", (job, cb) => {
          const id = job.attrs._id.toString();

          runCount[id] = runCount[id] ? runCount[id] + 1 : 1;
          cb();
        });

        agenda.processEvery(100);
        await agenda.start();

        await Promise.all([...new Array(10)].map(() => agenda.now("test-job")));

        await delay(jobTimeout);
        const ids = Object.keys(runCount);
        expect(ids).to.have.length(10);
        Object.keys(runCount).forEach((id) => {
          expect(runCount[id]).to.be(1);
        });
      });
    });
  });
});
