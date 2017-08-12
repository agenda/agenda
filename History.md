Next 2.0.0
==========

  * Drop support for MongoDB 2.4 ([#497](https://github.com/agenda/agenda/pull/497))


Next 1.0.0 / 2017-08-?
======================

* Gracefully recover from losing connection to MongoDB ([#472](https://github.com/agenda/agenda/pull/472))
* Code cleanup ([#492](https://github.com/agenda/agenda/pull/492))

BREAKING
--------
  * Fix jobs not running in order of them being queued ([#464](https://github.com/agenda/agenda/pull/464))

  * Changes in Cron string parsing, changed parsing library from [ncb000gt/node-cron](https://www.npmjs.com/package/cron) to [harrisiirak/cron-parser](https://www.npmjs.com/package/cron-parser) ([#475](https://github.com/agenda/agenda/pull/475))

Previously Agenda would treat months as 0-11 where as normally, cron months are parsed as 1-12.

```
* * * * * *
| | | | | |
| | | | | +-- Year              (range: 1900-3000)
| | | | +---- Day of the Week   (range: 1-7, 1 standing for Monday)
| | | +------ Month of the Year (range: 0-11) NOTE: Difference here
| | +-------- Day of the Month  (range: 1-31)
| +---------- Hour              (range: 0-23)
+------------ Minute            (range: 0-59)
```

Starting in version `1.0.0`, cron will be parsed in the standard UNIX style:
```
* * * * * *
| | | | | |
| | | | | +-- Year              (range: 1900-3000)
| | | | +---- Day of the Week   (range: 1-7, 1 standing for Monday)
| | | +------ Month of the Year (range: 1-12) NOTE: Difference here
| | +-------- Day of the Month  (range: 1-31)
| +---------- Hour              (range: 0-23)
+------------ Minute            (range: 0-59)
```


0.10.0 / 2017-08-08
==================
  * Replace the deprecated `findAndModify` method from native MongoDB driver to `findOneAndUpdate` ([#448](https://github.com/agenda/agenda/pull/448))
  * Going forward, we won't ensure Node.js v0.10 and v0.11 compatibility anymore ([#449](https://github.com/agenda/agenda/pull/449))
  * Code cleanup ([#491](https://github.com/agenda/agenda/pull/491), [#489](https://github.com/agenda/agenda/pull/489), [#488](https://github.com/agenda/agenda/pull/488), [#487](https://github.com/agenda/agenda/pull/487))

0.9.1 / 2017-03-22
==================

Republish release for NPM. Includes fixes from 0.9.0 release:

  * add support for `mongoose.connection` for `agenda.mongo()`, fixes #156
  * Fix for race condition in the afterEach clean up code (#355)
  * Fixes + protects against concurrency not being honored  (#379)


0.9.0 / 2016-12-28
==================
  * add support for `mongoose.connection` for `agenda.mongo()`, fixes #156
  * Fix for race condition in the afterEach clean up code (#355)
  * Fixes + protects against concurrency not being honored  (#379)
  * Bump mongodb dep version to support ssl conns (#368)
  * Increase Mongo compatability to 2.4

0.8.1 / 2016-05-08
==================

  * Add Node v6 to CI
  * 1. Update dev dependencies for out of date. 2. Small fix to job.js for invalid repeatAt
  * Update .npmignore
  * Fix doc: cb not marked as optional (closes #279)
  * Including nextRunAt check in query for on the fly lock.
  * Picking up any job with an expired lock (not just recurring or queued).
  * Fixed failing test
  * throw on processJobResult error
  * Requeuing concurrency blocked jobs wrt priority.
  * Processing the next job that is not blocked by concurrency.
  * Fix test which fails only sometimes
  * Add agendash as alternative ui
  * Merge pull request #288 from diesal11/master

0.8.0 / 2016-02-21
==================

  * Implementing lock limit
  * Use callback to handle errors if we can.

0.7.9 / 2016-02-05
==================

  * fix: ReferenceError: MongoError is not defined

0.7.8 / 2016-02-03
==================

  * fix: computeNextRunAt timezone bug

0.7.7 / 2016-01-25
==================

  * feat: add timezone option for repeatAt.
  * fix: job locking logic
  * fix: bug with jobs expiring and being enqueued anyway
  * fix: bug where jobs wouldn't run concurrently
  * fix: agenda throwing an exception when starting a job defined on another instance
  * fix: possible bug when using extended Array.prototype

0.7.6 / 2016-01-04
==================

  * feat: Add failCount attribute to jobs
  * fix: job priority for on the fly job lock and queueing is now respected
  * fix: make agenda.cancel no longer require a callback
  * fix: stale jobs running after a more up-to-date job has completed
  * fix: fail/success event emit after jobs have been saved in the database
  * fix: ready event when using config.mongo

0.7.5 / 2015-12-05
==================

  * Adds options.insertOnly to job.unique that prevents the job from being updated multiple times on multiple runs

0.7.4 / 2015-11-26
==================

  * fix job priority scheduling

0.7.3 / 2015-11-22
==================

  * add support for success callbacks on schedule, every and now (@mgregson)
  * using self for reference to collection (@3choBoomer)
  * emit ready from db_init (@jdiamond)

0.7.2 / 2015-10-22
==================

  * Rollback job completion callback to pre-0.7.0
  * Emit events when Agenda init is ready or has failed

0.7.0 / 2015-09-29
==================

  * Switch from mongoskin to mongodb native. Big thanks to the
  [classdojo](http://classdojo.com) team for this. Shoutouts to @liamdon,
  @jetzhou and @byronmwong for the help!

0.6.28 / 2015-02-13
==================

  * Fix for when _findAndLockNextJob returns multiple jobs.

0.6.27 / 2015-02-04
==================

 * code cleanup, fix leaking ignoreErrors

0.6.26 / 2014-11-30
==================

  * fix double run bug

0.6.25 / 2014-11-20
==================

 * Allow specifying mongo config (optionally)

0.6.24 / 2014-10-31
==================

 * Fix .every() running when using cron strings.

0.6.23 / 2014-10-25
==================

 * Remove debugger

0.6.22 / 2014-10-22
==================

 * add job.unique (@nwkeeley)

0.6.21 / 2014-10-20
==================

 * Re-add tests for those who use the `npat` option.

0.6.20 / 2014-10-14
==================

 * add job.disable() and job.enable()
 * Added .npmignore for test/ build scripts.

0.6.19 / 2014-09-03
==================

 * Create database indexes when initializing Agenda instance (@andyneville)

0.6.18 / 2014-08-16
==================

 * Implemented job.isRunning()
 * Fixed issue where jobs would continue being processed after agenda is explicitly stopped
 * Fixed complete event being emitted before asynchronous jobs are finished

0.6.17 / 2014-08-11
==================

 * add job.repeatAt

0.6.16 / 2014-06-16
==================

 * fix job queue being processed even when agenda was stopped
 * fix agenda.every method

0.6.15 / 2014-06-11
==================

 * fix agenda.every overwriting nextRunAt [closes #70]

0.6.14 / 2014-06-06
==================

 * Added agenda.cancel function
 * Fix more circumstances where jobs re-create after remove

0.6.13 / 2014-06-01
==================

 * fix jobs resaving after remove [closes #66]
 * fix jobs skipping in line from database querying

0.6.12/ 2014-05-22
==================

 * update saveJob to allow for pre-set Ids [closes #64]

0.6.11/ 2014-05-19
==================

 * add job.touch to reset lock lifetime [references #63]

0.6.10 / 2014-05-13
==================

 * make job saving use agenda._name

0.6.9 / 2014-05-13
==================

 * add agenda.name config method
 * fix agenda.mongo not being chainable

0.6.8 / 2014-05-06
==================

 * add graceful job unlocking to stop

0.6.7 / 2014-04-21
==================

 * Implement, document, and test defaultLockLifetime [@shakefu]

0.6.6 / 2014-04-21
==================

 * Bump date.js version [@psema4]

0.6.5 / 2014-04-17
==================

 * mongoskin version bump (better support for mongodb 2.6) [@loginx]

0.6.4 / 2014-04-09
==================

 * fix $setOnInsert with empty obj cause mongodb 2.6 complain [@inetfuture]

0.6.3 / 2014-04-07
==================

 * fix cron-jobs executing multiple times
 * fail the job if repeat interval is wrong

0.6.2 / 2014-03-25
==================

 * fix bug that resulted in jobs scheduled in memory to always re-run
 * Update mongoskin to 1.3

0.6.1 / 2014-03-24
==================

 * allow every and schedule to take array of job names

0.6.0 / 2014-03-21 (NO BREAKING CHANGES)
==================

 * convert to using setTimeout for precise job scheduling [closes #6]

0.5.10/ 2014-03-20
==================

 * fix agenda.every not properly saving jobs
 * improve instantiating jobs, fixes bug where certain attrs weren't loaded in

0.5.9 / 2014-03-10
==================

 * add job#remove method

0.5.8 / 2014-03-07
==================

 * Fixed single jobs not being saved properly [closes #38]

0.5.7 / 2014-03-06
==================

 * fix every re-running jobs out of queue at load

0.5.6 / 2014-02-18
==================

 * Added failing for jobs with undefined definitions
 * Added agenda.purge() to remove old jobs

0.5.5 / 2014-01-28
==================

 * added support to directly give mongoskin object, to help minimize connections

0.5.4 / 2014-01-09
==================

 * Added start event to jobs. (@clayzermki)

0.5.3 / 2014-01-06
==================

 * Added agenda.now method

0.5.2 / 2014-01-06
==================

 * Added ability for job.fail to take an error

0.5.1 / 2013-01-04 (Backwards compatible!)
==================
 * Updated version of humanInterval, adding weeks and months support

0.5.0 / 2013-12-19 (Backwards compatible!)
==================

 * Added job locking mechanism, enabling support for multiple works / agenda instances (@bars3s)

0.4.4 / 2013-12-13
==================

 * fix job.toJson method: add failReason & failedAt attrs (Broken in 0.4.3 and 0.4.2)
 * fix job cb for working with 'q' promises

0.4.3 / 2013-12-13
==================

 * fix job.schedule's taking Date object as 'when' argument [@bars3s]

0.4.2 / 2013-12-11
==================

 * Refactored Job to ensure that everything is stored as an ISODate in the Database. [Closes #14] [@raisch]

0.4.1 / 2013-12-10
==================

 * Added support for synchronous job definitions

0.4.0 / 2013-12-04
==================

 * Added Cron Support [Closes #2]
 * removed modella dependency

0.3.1 / 2013-11-19
==================

 * Fix for setImmediate on Node 0.8

0.3.0 / 2013-11-19
==================

 * Added Events to the Event Queue [References #7]

0.2.1 / 2013-11-14
==================

 * Fixed a bug where mongo wasn't giving updated document

0.2.0 / 2013-11-07
==================

 * Added error for running undefined job. [Closes #4]
 * Fixed critical error where new jobs are not correctly saved.

0.1.3 / 2013-11-06
==================

 * Small Bug fix for global-namespace pollution

0.1.2 / 2013-10-31
==================

 * Updated write concern to avoid annoying notices

0.1.1 / 2013-10-28
==================

  * Removed unecessary UUID code

0.1.0 / 2013-10-28
==================

  * Initial Release
