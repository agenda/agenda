<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/agenda/agenda@master/agenda.svg" alt="Agenda" width="100" height="100">
</p>
<p align="center">
  A light-weight job scheduling library for Node.js
</p>
<p align="center">
  <a href="https://slackin-ekwifvcwbr.now.sh/"><img src="https://slackin-ekwifvcwbr.now.sh/badge.svg" alt="Slack Status"></a>
  <a href="https://david-dm.org/agenda/agenda"><img src="https://david-dm.org/agenda/agenda/status.svg" alt="dependencies Status"></a>
  <a href="https://david-dm.org/agenda/agenda?type=dev"><img src="https://david-dm.org/agenda/agenda/dev-status.svg" alt="devDependencies Status"></a>
  <a href="https://coveralls.io/github/agenda/agenda?branch=master"><img src="https://coveralls.io/repos/github/agenda/agenda/badge.svg?branch=master" alt="Coverage Status"></a>
	<br>
	<br>
	<br>
</p>

# Agenda offers

- Minimal overhead. Agenda aims to keep its code base small.
- Mongo backed persistence layer.
- Promises based API.
- Scheduling with configurable priority, concurrency, and repeating.
- Scheduling via cron or human readable syntax.
- Event backed job queue that you can hook into.
- [Agenda-rest](https://github.com/agenda/agenda-rest): optional standalone REST API.
- [Inversify-agenda](https://github.com/lautarobock/inversify-agenda) - Some utilities for the development of agenda workers with Inversify.
- [Agendash](https://github.com/agenda/agendash): optional standalone web-interface.

### Feature Comparison

Since there are a few job queue solutions, here a table comparing them to help you use the one that
better suits your needs.

Agenda is great if you need a MongoDB job scheduler, but try **[Bree](https://jobscheduler.net)** if you need something simpler (built by a previous maintainer).

| Feature          |      Bull       |   Bee    | Agenda |
| :--------------- | :-------------: | :------: | :----: |
| Backend          |      redis      |  redis   | mongo  |
| Priorities       |        ✓        |          |   ✓    |
| Concurrency      |        ✓        |    ✓     |   ✓    |
| Delayed jobs     |        ✓        |          |   ✓    |
| Global events    |        ✓        |          |        |
| Rate Limiter     |        ✓        |          |        |
| Pause/Resume     |        ✓        |          |        |
| Sandboxed worker |        ✓        |          |        |
| Repeatable jobs  |        ✓        |          |   ✓    |
| Atomic ops       |        ✓        |    ✓     |        |
| Persistence      |        ✓        |    ✓     |   ✓    |
| UI               |        ✓        |          |   ✓    |
| REST API         |                 |          |   ✓    |
| Optimized for    | Jobs / Messages | Messages |  Jobs  |

_Kudos for making the comparison chart goes to [Bull](https://www.npmjs.com/package/bull#feature-comparison) maintainers._

# Installation

### Notice

In order to support new MongoDB 5.0 and mongodb node.js driver/package the next release (5.x.x) of Agenda will be major. The required node version will become >=12. The mongodb dependency version will become >=3.2.

Install via NPM

    npm install agenda

You will also need a working [Mongo](https://www.mongodb.com/) database (v3) to point it to.

# CJS / Module Imports

for regular javascript code, just use the default entrypoint

```js
const Agenda = require("agenda");
```

For Typescript, Webpack or other module imports, use `agenda/es` entrypoint:
e.g.

```ts
import { Agenda } from "agenda/es";
```

**_NOTE_**: If you're migrating from `@types/agenda` you also should change imports to `agenda/es`.
Instead of `import Agenda from 'agenda'` use `import Agenda from 'agenda/es'`.

# Example Usage

```js
const mongoConnectionString = "mongodb://127.0.0.1/agenda";

const agenda = new Agenda({ db: { address: mongoConnectionString } });

// Or override the default collection name:
// const agenda = new Agenda({db: {address: mongoConnectionString, collection: 'jobCollectionName'}});

// or pass additional connection options:
// const agenda = new Agenda({db: {address: mongoConnectionString, collection: 'jobCollectionName', options: {ssl: true}}});

// or pass in an existing mongodb-native MongoClient instance
// const agenda = new Agenda({mongo: myMongoClient});

agenda.define("delete old users", async (job) => {
  await User.remove({ lastLogIn: { $lt: twoDaysAgo } });
});

(async function () {
  // IIFE to give access to async/await
  await agenda.start();

  await agenda.every("3 minutes", "delete old users");

  // Alternatively, you could also do:
  await agenda.every("*/3 * * * *", "delete old users");
})();
```

```js
agenda.define(
  "send email report",
  { priority: "high", concurrency: 10 },
  async (job) => {
    const { to } = job.attrs.data;
    await emailClient.send({
      to,
      from: "example@example.com",
      subject: "Email Report",
      body: "...",
    });
  }
);

(async function () {
  await agenda.start();
  await agenda.schedule("in 20 minutes", "send email report", {
    to: "admin@example.com",
  });
})();
```

```js
(async function () {
  const weeklyReport = agenda.create("send email report", {
    to: "example@example.com",
  });
  await agenda.start();
  await weeklyReport.repeatEvery("1 week").save();
})();
```

# Full documentation

Agenda's basic control structure is an instance of an agenda. Agenda's are
mapped to a database collection and load the jobs from within.

## Table of Contents

- [Configuring an agenda](#configuring-an-agenda)
- [Agenda Events](#agenda-events)
- [Defining job processors](#defining-job-processors)
- [Creating jobs](#creating-jobs)
- [Managing jobs](#managing-jobs)
- [Starting the job processor](#starting-the-job-processor)
- [Multiple job processors](#multiple-job-processors)
- [Manually working with jobs](#manually-working-with-a-job)
- [Job Queue Events](#job-queue-events)
- [Frequently asked questions](#frequently-asked-questions)
- [Example Project structure](#example-project-structure)
- [Known Issues](#known-issues)
- [Debugging Issues](#debugging-issues)
- [Acknowledgements](#acknowledgements)

## Configuring an agenda

All configuration methods are chainable, meaning you can do something like:

```js
const agenda = new Agenda();
agenda
  .database(...)
  .processEvery('3 minutes')
  ...;
```

Agenda uses [Human Interval](http://github.com/rschmukler/human-interval) for specifying the intervals. It supports the following units:

`seconds`, `minutes`, `hours`, `days`,`weeks`, `months` -- assumes 30 days, `years` -- assumes 365 days

More sophisticated examples

```js
agenda.processEvery("one minute");
agenda.processEvery("1.5 minutes");
agenda.processEvery("3 days and 4 hours");
agenda.processEvery("3 days, 4 hours and 36 seconds");
```

### database(url, [collectionName])

Specifies the database at the `url` specified. If no collection name is given,
`agendaJobs` is used.

```js
agenda.database("localhost:27017/agenda-test", "agendaJobs");
```

You can also specify it during instantiation.

```js
const agenda = new Agenda({
  db: { address: "localhost:27017/agenda-test", collection: "agendaJobs" },
});
```

Agenda will emit a `ready` event (see [Agenda Events](#agenda-events)) when properly connected to the database.
It is safe to call `agenda.start()` without waiting for this event, as this is handled internally.
If you're using the `db` options, or call `database`, then you may still need to listen for `ready` before saving jobs.

### mongo(dbInstance)

Use an existing mongodb-native MongoClient/Db instance. This can help consolidate connections to a
database. You can instead use `.database` to have agenda handle connecting for you.

You can also specify it during instantiation:

```js
const agenda = new Agenda({ mongo: mongoClientInstance.db("agenda-test") });
```

Note that MongoClient.connect() returns a mongoClientInstance since [node-mongodb-native 3.0.0](https://github.com/mongodb/node-mongodb-native/blob/master/CHANGES_3.0.0.md), while it used to return a dbInstance that could then be directly passed to agenda.

### name(name)

Sets the `lastModifiedBy` field to `name` in the jobs collection.
Useful if you have multiple job processors (agendas) and want to see which
job queue last ran the job.

```js
agenda.name(os.hostname + "-" + process.pid);
```

You can also specify it during instantiation

```js
const agenda = new Agenda({ name: "test queue" });
```

### processEvery(interval)

Takes a string `interval` which can be either a traditional javascript number,
or a string such as `3 minutes`

Specifies the frequency at which agenda will query the database looking for jobs
that need to be processed. Agenda internally uses `setTimeout` to guarantee that
jobs run at (close to ~3ms) the right time.

Decreasing the frequency will result in fewer database queries, but more jobs
being stored in memory.

Also worth noting is that if the job queue is shutdown, any jobs stored in memory
that haven't run will still be locked, meaning that you may have to wait for the
lock to expire. By default it is `'5 seconds'`.

```js
agenda.processEvery("1 minute");
```

You can also specify it during instantiation

```js
const agenda = new Agenda({ processEvery: "30 seconds" });
```

### maxConcurrency(number)

Takes a `number` which specifies the max number of jobs that can be running at
any given moment. By default it is `20`.

```js
agenda.maxConcurrency(20);
```

You can also specify it during instantiation

```js
const agenda = new Agenda({ maxConcurrency: 20 });
```

### defaultConcurrency(number)

Takes a `number` which specifies the default number of a specific job that can be running at
any given moment. By default it is `5`.

```js
agenda.defaultConcurrency(5);
```

You can also specify it during instantiation

```js
const agenda = new Agenda({ defaultConcurrency: 5 });
```

### lockLimit(number)

Takes a `number` which specifies the max number jobs that can be locked at any given moment. By default it is `0` for no max.

```js
agenda.lockLimit(0);
```

You can also specify it during instantiation

```js
const agenda = new Agenda({ lockLimit: 0 });
```

### defaultLockLimit(number)

Takes a `number` which specifies the default number of a specific job that can be locked at any given moment. By default it is `0` for no max.

```js
agenda.defaultLockLimit(0);
```

You can also specify it during instantiation

```js
const agenda = new Agenda({ defaultLockLimit: 0 });
```

### defaultLockLifetime(number)

Takes a `number` which specifies the default lock lifetime in milliseconds. By
default it is 10 minutes. This can be overridden by specifying the
`lockLifetime` option to a defined job.

A job will unlock if it is finished (ie. the returned Promise resolves/rejects
or `done` is specified in the params and `done()` is called) before the
`lockLifetime`. The lock is useful if the job crashes or times out.

```js
agenda.defaultLockLifetime(10000);
```

You can also specify it during instantiation

```js
const agenda = new Agenda({ defaultLockLifetime: 10000 });
```

### sort(query)

Takes a `query` which specifies the sort query to be used for finding and locking the next job.

By default it is `{ nextRunAt: 1, priority: -1 }`, which obeys a first in first out approach, with respect to priority.

## Agenda Events

An instance of an agenda will emit the following events:

- `ready` - called when Agenda mongo connection is successfully opened and indices created.
  If you're passing agenda an existing connection, you shouldn't need to listen for this, as `agenda.start()` will not resolve until indices have been created.
  If you're using the `db` options, or call `database`, then you may still need to listen for the `ready` event before saving jobs. `agenda.start()` will still wait for the connection to be opened.
- `error` - called when Agenda mongo connection process has thrown an error

```js
await agenda.start();
```

## Defining Job Processors

Before you can use a job, you must define its processing behavior.

### define(jobName, [options], handler)

Defines a job with the name of `jobName`. When a job of `jobName` gets run, it
will be passed to `handler(job, done)`. To maintain asynchronous behavior, you may
either provide a Promise-returning function in `handler` _or_ provide `done` as a
second parameter to `handler`. If `done` is specified in the function signature, you
must call `done()` when you are processing the job. If your function is
synchronous or returns a Promise, you may omit `done` from the signature.

`options` is an optional argument which can overwrite the defaults. It can take
the following:

- `concurrency`: `number` maximum number of that job that can be running at once (per instance of agenda)
- `lockLimit`: `number` maximum number of that job that can be locked at once (per instance of agenda)
- `lockLifetime`: `number` interval in ms of how long the job stays locked for (see [multiple job processors](#multiple-job-processors) for more info).
  A job will automatically unlock once a returned promise resolves/rejects (or if `done` is specified in the signature and `done()` is called).
- `priority`: `(lowest|low|normal|high|highest|number)` specifies the priority
  of the job. Higher priority jobs will run first. See the priority mapping
  below

Priority mapping:

```
{
  highest: 20,
  high: 10,
  normal: 0,
  low: -10,
  lowest: -20
}
```

Async Job:

```js
agenda.define("some long running job", async (job) => {
  const data = await doSomelengthyTask();
  await formatThatData(data);
  await sendThatData(data);
});
```

Async Job (using `done`):

```js
agenda.define("some long running job", (job, done) => {
  doSomelengthyTask((data) => {
    formatThatData(data);
    sendThatData(data);
    done();
  });
});
```

Sync Job:

```js
agenda.define("say hello", (job) => {
  console.log("Hello!");
});
```

`define()` acts like an assignment: if `define(jobName, ...)` is called multiple times (e.g. every time your script starts), the definition in the last call will overwrite the previous one. Thus, if you `define` the `jobName` only once in your code, it's safe for that call to execute multiple times.

## Creating Jobs

### every(interval, name, [data], [options])

Runs job `name` at the given `interval`. Optionally, data and options can be passed in.
Every creates a job of type `single`, which means that it will only create one
job in the database, even if that line is run multiple times. This lets you put
it in a file that may get run multiple times, such as `webserver.js` which may
reboot from time to time.

`interval` can be a human-readable format `String`, a cron format `String`, or a `Number`.

`data` is an optional argument that will be passed to the processing function
under `job.attrs.data`.

`options` is an optional argument that will be passed to [`job.repeatEvery`](#repeateveryinterval-options).
In order to use this argument, `data` must also be specified.

Returns the `job`.

```js
agenda.define("printAnalyticsReport", async (job) => {
  const users = await User.doSomethingReallyIntensive();
  processUserData(users);
  console.log("I print a report!");
});

agenda.every("15 minutes", "printAnalyticsReport");
```

Optionally, `name` could be array of job names, which is convenient for scheduling
different jobs for same `interval`.

```js
agenda.every("15 minutes", [
  "printAnalyticsReport",
  "sendNotifications",
  "updateUserRecords",
]);
```

In this case, `every` returns array of `jobs`.

### schedule(when, name, [data])

Schedules a job to run `name` once at a given time. `when` can be a `Date` or a
`String` such as `tomorrow at 5pm`.

`data` is an optional argument that will be passed to the processing function
under `job.attrs.data`.

Returns the `job`.

```js
agenda.schedule("tomorrow at noon", "printAnalyticsReport", { userCount: 100 });
```

Optionally, `name` could be array of job names, similar to the `every` method.

```js
agenda.schedule("tomorrow at noon", [
  "printAnalyticsReport",
  "sendNotifications",
  "updateUserRecords",
]);
```

In this case, `schedule` returns array of `jobs`.

### now(name, [data])

Schedules a job to run `name` once immediately.

`data` is an optional argument that will be passed to the processing function
under `job.attrs.data`.

Returns the `job`.

```js
agenda.now("do the hokey pokey");
```

### create(jobName, data)

Returns an instance of a `jobName` with `data`. This does _NOT_ save the job in
the database. See below to learn how to manually work with jobs.

```js
const job = agenda.create("printAnalyticsReport", { userCount: 100 });
await job.save();
console.log("Job successfully saved");
```

## Managing Jobs

### jobs(mongodb-native query, mongodb-native sort, mongodb-native limit, mongodb-native skip)

Lets you query (then sort, limit and skip the result) all of the jobs in the agenda job's database. These are full [mongodb-native](https://github.com/mongodb/node-mongodb-native) `find`, `sort`, `limit` and `skip` commands. See mongodb-native's documentation for details.

```js
const jobs = await agenda.jobs(
  { name: "printAnalyticsReport" },
  { data: -1 },
  3,
  1
);
// Work with jobs (see below)
```

### cancel(mongodb-native query)

Cancels any jobs matching the passed mongodb-native query, and removes them from the database. Returns a Promise resolving to the number of cancelled jobs, or rejecting on error.

```js
const numRemoved = await agenda.cancel({ name: "printAnalyticsReport" });
```

This functionality can also be achieved by first retrieving all the jobs from the database using `agenda.jobs()`, looping through the resulting array and calling `job.remove()` on each. It is however preferable to use `agenda.cancel()` for this use case, as this ensures the operation is atomic.

### disable(mongodb-native query)

Disables any jobs matching the passed mongodb-native query, preventing any matching jobs from being run by the Job Processor.

```js
const numDisabled = await agenda.disable({ name: "pollExternalService" });
```

Similar to `agenda.cancel()`, this functionality can be acheived with a combination of `agenda.jobs()` and `job.disable()`

### enable(mongodb-native query)

Enables any jobs matching the passed mongodb-native query, allowing any matching jobs to be run by the Job Processor.

```js
const numEnabled = await agenda.enable({ name: "pollExternalService" });
```

Similar to `agenda.cancel()`, this functionality can be acheived with a combination of `agenda.jobs()` and `job.enable()`

### purge()

Removes all jobs in the database without defined behaviors. Useful if you change a definition name and want to remove old jobs. Returns a Promise resolving to the number of removed jobs, or rejecting on error.

_IMPORTANT:_ Do not run this before you finish defining all of your jobs. If you do, you will nuke your database of jobs.

```js
const numRemoved = await agenda.purge();
```

## Starting the job processor

To get agenda to start processing jobs from the database you must start it. This
will schedule an interval (based on `processEvery`) to check for new jobs and
run them. You can also stop the queue.

### start

Starts the job queue processing, checking [`processEvery`](#processeveryinterval) time to see if there
are new jobs. Must be called _after_ `processEvery`, and _before_ any job scheduling (e.g. `every`).

### stop

Stops the job queue processing. Unlocks currently running jobs.

This can be very useful for graceful shutdowns so that currently running/grabbed jobs are abandoned so that other
job queues can grab them / they are unlocked should the job queue start again. Here is an example of how to do a graceful
shutdown.

```js
async function graceful() {
  await agenda.stop();
  process.exit(0);
}

process.on("SIGTERM", graceful);
process.on("SIGINT", graceful);
```

### close(force)

Closes database connection. You don't normally have to do this, but it might be useful for testing purposes.

Using `force` boolean you can force close connection.

Read more from [Node.js MongoDB Driver API](https://mongodb.github.io/node-mongodb-native/2.0/api/Db.html#close)

```js
await agenda.close({ force: true });
```

## Multiple job processors

Sometimes you may want to have multiple node instances / machines process from
the same queue. Agenda supports a locking mechanism to ensure that multiple
queues don't process the same job.

You can configure the locking mechanism by specifying `lockLifetime` as an
interval when defining the job.

```js
agenda.define("someJob", { lockLifetime: 10000 }, (job, cb) => {
  // Do something in 10 seconds or less...
});
```

This will ensure that no other job processor (this one included) attempts to run the job again
for the next 10 seconds. If you have a particularly long running job, you will want to
specify a longer lockLifetime.

By default it is 10 minutes. Typically you shouldn't have a job that runs for 10 minutes,
so this is really insurance should the job queue crash before the job is unlocked.

When a job is finished (i.e. the returned promise resolves/rejects or `done` is
specified in the signature and `done()` is called), it will automatically unlock.

## Manually working with a job

A job instance has many instance methods. All mutating methods must be followed
with a call to `await job.save()` in order to persist the changes to the database.

### repeatEvery(interval, [options])

Specifies an `interval` on which the job should repeat. The job runs at the time of defining as well in configured intervals, that is "run _now_ and in intervals".

`interval` can be a human-readable format `String`, a cron format `String`, or a `Number`.

`options` is an optional argument containing:

`options.timezone`: should be a string as accepted by [moment-timezone](https://momentjs.com/timezone/) and is considered when using an interval in the cron string format.

`options.skipImmediate`: `true` | `false` (default) Setting this `true` will skip the immediate run. The first run will occur only in configured interval.

`options.startDate`: `Date` the first time the job runs, should be equal or after the start date.

`options.endDate`: `Date` the job should not repeat after the endDate. The job can run on the end-date itself, but not after that.

`options.skipDays`: `humand readable string` ('2 days'). After each run, it will skip the duration of 'skipDays'

```js
job.repeatEvery("10 minutes");
await job.save();
```

```js
job.repeatEvery("3 minutes", {
  skipImmediate: true,
});
await job.save();
```

```js
job.repeatEvery("0 6 * * *", {
  timezone: "America/New_York",
});
await job.save();
```

### repeatAt(time)

Specifies a `time` when the job should repeat. [Possible values](https://github.com/matthewmueller/date#examples)

```js
job.repeatAt("3:30pm");
await job.save();
```

### schedule(time)

Specifies the next `time` at which the job should run.

```js
job.schedule("tomorrow at 6pm");
await job.save();
```

### priority(priority)

Specifies the `priority` weighting of the job. Can be a number or a string from
the above priority table.

```js
job.priority("low");
await job.save();
```

### unique(properties, [options])

Ensure that only one instance of this job exists with the specified properties

`options` is an optional argument which can overwrite the defaults. It can take
the following:

- `insertOnly`: `boolean` will prevent any properties from persisting if the job already exists. Defaults to false.

```js
job.unique({ "data.type": "active", "data.userId": "123", nextRunAt: date });
await job.save();
```

_IMPORTANT:_ To [guarantee uniqueness](https://docs.mongodb.com/manual/reference/method/db.collection.update/#use-unique-indexes) as well as avoid high CPU usage by MongoDB make sure to create a unique index on the used fields, like `name`, `data.type` and `data.userId` for the example above.

### fail(reason)

Sets `job.attrs.failedAt` to `now`, and sets `job.attrs.failReason` to `reason`.

Optionally, `reason` can be an error, in which case `job.attrs.failReason` will
be set to `error.message`

```js
job.fail("insufficient disk space");
// or
job.fail(new Error("insufficient disk space"));
await job.save();
```

### run(callback)

Runs the given `job` and calls `callback(err, job)` upon completion. Normally
you never need to call this manually.

```js
job.run((err, job) => {
  console.log("I don't know why you would need to do this...");
});
```

### save()

Saves the `job.attrs` into the database. Returns a Promise resolving to a Job instance, or rejecting on error.

```js
try {
  await job.save();
  console.log("Successfully saved job to collection");
} catch (e) {
  console.error("Error saving job to collection");
}
```

### remove()

Removes the `job` from the database. Returns a Promise resolving to the number of jobs removed, or rejecting on error.

```js
try {
  await job.remove();
  console.log("Successfully removed job from collection");
} catch (e) {
  console.error("Error removing job from collection");
}
```

### disable()

Disables the `job`. Upcoming runs won't execute.

### enable()

Enables the `job` if it got disabled before. Upcoming runs will execute.

### touch()

Resets the lock on the job. Useful to indicate that the job hasn't timed out
when you have very long running jobs. The call returns a promise that resolves
when the job's lock has been renewed.

```js
agenda.define("super long job", async (job) => {
  await doSomeLongTask();
  await job.touch();
  await doAnotherLongTask();
  await job.touch();
  await finishOurLongTasks();
});
```

## Job Queue Events

An instance of an agenda will emit the following events:

- `start` - called just before a job starts
- `start:job name` - called just before the specified job starts

```js
agenda.on("start", (job) => {
  console.log("Job %s starting", job.attrs.name);
});
```

- `complete` - called when a job finishes, regardless of if it succeeds or fails
- `complete:job name` - called when a job finishes, regardless of if it succeeds or fails

```js
agenda.on("complete", (job) => {
  console.log(`Job ${job.attrs.name} finished`);
});
```

- `success` - called when a job finishes successfully
- `success:job name` - called when a job finishes successfully

```js
agenda.on("success:send email", (job) => {
  console.log(`Sent Email Successfully to ${job.attrs.data.to}`);
});
```

- `fail` - called when a job throws an error
- `fail:job name` - called when a job throws an error

```js
agenda.on("fail:send email", (err, job) => {
  console.log(`Job failed with error: ${err.message}`);
});
```

## Frequently Asked Questions

### What is the order in which jobs run?

Jobs are run with priority in a first in first out order (so they will be run in the order they were scheduled AND with respect to highest priority).

For example, if we have two jobs named "send-email" queued (both with the same priority), and the first job is queued at 3:00 PM and second job is queued at 3:05 PM with the same `priority` value, then the first job will run first if we start to send "send-email" jobs at 3:10 PM. However if the first job has a priority of `5` and the second job has a priority of `10`, then the second will run first (priority takes precedence) at 3:10 PM.

The default [MongoDB sort object](https://docs.mongodb.com/manual/reference/method/cursor.sort/) is `{ nextRunAt: 1, priority: -1 }` and can be changed through the option `sort` when configuring Agenda.

### What is the difference between `lockLimit` and `maxConcurrency`?

Agenda will lock jobs 1 by one, setting the `lockedAt` property in mongoDB, and creating an instance of the `Job` class which it caches into the `_lockedJobs` array. This defaults to having no limit, but can be managed using lockLimit. If all jobs will need to be run before agenda's next interval (set via `agenda.processEvery`), then agenda will attempt to lock all jobs.

Agenda will also pull jobs from `_lockedJobs` and into `_runningJobs`. These jobs are actively being worked on by user code, and this is limited by `maxConcurrency` (defaults to 20).

If you have multiple instances of agenda processing the same job definition with a fast repeat time you may find they get unevenly loaded. This is because they will compete to lock as many jobs as possible, even if they don't have enough concurrency to process them. This can be resolved by tweaking the `maxConcurrency` and `lockLimit` properties.

### Sample Project Structure?

Agenda doesn't have a preferred project structure and leaves it to the user to
choose how they would like to use it. That being said, you can check out the
[example project structure](#example-project-structure) below.

### Can I Donate?

Thanks! I'm flattered, but it's really not necessary. If you really want to, you can find my [gittip here](https://www.gittip.com/rschmukler/).

### Web Interface?

Agenda itself does not have a web interface built in but we do offer stand-alone web interface [Agendash](https://github.com/agenda/agendash):

<a href="https://raw.githubusercontent.com/agenda/agendash/master/job-details.png"><img src="https://raw.githubusercontent.com/agenda/agendash/master/job-details.png" style="max-width:100%" alt="Agendash interface"></a>

### Mongo vs Redis

The decision to use Mongo instead of Redis is intentional. Redis is often used for
non-essential data (such as sessions) and without configuration doesn't
guarantee the same level of persistence as Mongo (should the server need to be
restarted/crash).

Agenda decides to focus on persistence without requiring special configuration
of Redis (thereby degrading the performance of the Redis server on non-critical
data, such as sessions).

Ultimately if enough people want a Redis driver instead of Mongo, I will write
one. (Please open an issue requesting it). For now, Agenda decided to focus on
guaranteed persistence.

### Spawning / forking processes

Ultimately Agenda can work from a single job queue across multiple machines, node processes, or forks. If you are interested in having more than one worker, [Bars3s](http://github.com/bars3s) has written up a fantastic example of how one might do it:

```js
const cluster = require("cluster");
const os = require("os");

const httpServer = require("./app/http-server");
const jobWorker = require("./app/job-worker");

const jobWorkers = [];
const webWorkers = [];

if (cluster.isMaster) {
  const cpuCount = os.cpus().length;
  // Create a worker for each CPU
  for (let i = 0; i < cpuCount; i += 1) {
    addJobWorker();
    addWebWorker();
  }

  cluster.on("exit", (worker, code, signal) => {
    if (jobWorkers.indexOf(worker.id) !== -1) {
      console.log(
        `job worker ${worker.process.pid} exited (signal: ${signal}). Trying to respawn...`
      );
      removeJobWorker(worker.id);
      addJobWorker();
    }

    if (webWorkers.indexOf(worker.id) !== -1) {
      console.log(
        `http worker ${worker.process.pid} exited (signal: ${signal}). Trying to respawn...`
      );
      removeWebWorker(worker.id);
      addWebWorker();
    }
  });
} else {
  if (process.env.web) {
    console.log(`start http server: ${cluster.worker.id}`);
    // Initialize the http server here
    httpServer.start();
  }

  if (process.env.job) {
    console.log(`start job server: ${cluster.worker.id}`);
    // Initialize the Agenda here
    jobWorker.start();
  }
}

function addWebWorker() {
  webWorkers.push(cluster.fork({ web: 1 }).id);
}

function addJobWorker() {
  jobWorkers.push(cluster.fork({ job: 1 }).id);
}

function removeWebWorker(id) {
  webWorkers.splice(webWorkers.indexOf(id), 1);
}

function removeJobWorker(id) {
  jobWorkers.splice(jobWorkers.indexOf(id), 1);
}
```

### Recovering lost Mongo connections ("auto_reconnect")

Agenda is configured by default to automatically reconnect indefinitely, emitting an [error event](#agenda-events)
when no connection is available on each [process tick](#processeveryinterval), allowing you to restore the Mongo
instance without having to restart the application.

However, if you are using an [existing Mongo client](#mongomongoclientinstance)
you'll need to configure the `reconnectTries` and `reconnectInterval` [connection settings](http://mongodb.github.io/node-mongodb-native/3.0/reference/connecting/connection-settings/)
manually, otherwise you'll find that Agenda will throw an error with the message "MongoDB connection is not recoverable,
application restart required" if the connection cannot be recovered within 30 seconds.

# Example Project Structure

Agenda will only process jobs that it has definitions for. This allows you to
selectively choose which jobs a given agenda will process.

Consider the following project structure, which allows us to share models with
the rest of our code base, and specify which jobs a worker processes, if any at
all.

```
- server.js
- worker.js
lib/
  - agenda.js
  controllers/
    - user-controller.js
  jobs/
    - email.js
    - video-processing.js
    - image-processing.js
   models/
     - user-model.js
     - blog-post.model.js
```

Sample job processor (eg. `jobs/email.js`)

```js
let email = require("some-email-lib"),
  User = require("../models/user-model.js");

module.exports = function (agenda) {
  agenda.define("registration email", async (job) => {
    const user = await User.get(job.attrs.data.userId);
    await email(
      user.email(),
      "Thanks for registering",
      "Thanks for registering " + user.name()
    );
  });

  agenda.define("reset password", async (job) => {
    // Etc
  });

  // More email related jobs
};
```

lib/agenda.js

```js
const Agenda = require("agenda");

const connectionOpts = {
  db: { address: "localhost:27017/agenda-test", collection: "agendaJobs" },
};

const agenda = new Agenda(connectionOpts);

const jobTypes = process.env.JOB_TYPES ? process.env.JOB_TYPES.split(",") : [];

jobTypes.forEach((type) => {
  require("./jobs/" + type)(agenda);
});

if (jobTypes.length) {
  agenda.start(); // Returns a promise, which should be handled appropriately
}

module.exports = agenda;
```

lib/controllers/user-controller.js

```js
let app = express(),
  User = require("../models/user-model"),
  agenda = require("../worker.js");

app.post("/users", (req, res, next) => {
  const user = new User(req.body);
  user.save((err) => {
    if (err) {
      return next(err);
    }
    agenda.now("registration email", { userId: user.primary() });
    res.send(201, user.toJson());
  });
});
```

worker.js

```js
require("./lib/agenda.js");
```

Now you can do the following in your project:

```bash
node server.js
```

Fire up an instance with no `JOB_TYPES`, giving you the ability to process jobs,
but not wasting resources processing jobs.

```bash
JOB_TYPES=email node server.js
```

Allow your http server to process email jobs.

```bash
JOB_TYPES=email node worker.js
```

Fire up an instance that processes email jobs.

```bash
JOB_TYPES=video-processing,image-processing node worker.js
```

Fire up an instance that processes video-processing/image-processing jobs. Good for a heavy hitting server.

# Debugging Issues

If you think you have encountered a bug, please feel free to report it here:

[Submit Issue](https://github.com/agenda/agenda/issues/new)

Please provide us with as much details as possible such as:

- Agenda version
- Environment (OSX, Linux, Windows, etc)
- Small description of what happened
- Any relevant stack track
- Agenda logs (see below)

#### To turn on logging, please set your DEBUG env variable like so:

- OSX: `DEBUG="agenda:*" ts-node src/index.js`
- Linux: `DEBUG="agenda:*" ts-node src/index.js`
- Windows CMD: `set DEBUG=agenda:*`
- Windows PowerShell: `$env:DEBUG = "agenda:*"`

While not necessary, attaching a text file with this debug information would
be extremely useful in debugging certain issues and is encouraged.

# Known Issues

#### "Multiple order-by items are not supported. Please specify a single order-by item."

When running Agenda on Azure cosmosDB, you might run into this issue caused by Agenda's sort query used for finding and locking the next job. To fix this, you can pass [custom sort option](https://github.com/agenda/agenda#sortquery): `sort: { nextRunAt: 1 }`

# Acknowledgements

- Agenda was originally created by [@rschmukler](https://github.com/rschmukler).
- [Agendash](https://github.com/agenda/agendash) was originally created by [@joeframbach](https://github.com/joeframbach).
- These days Agenda has a great community of [contributors](https://github.com/agenda/agenda/graphs/contributors) around it. [Join us!](https://github.com/agenda/agenda/wiki)

# License

[The MIT License](LICENSE.md)
