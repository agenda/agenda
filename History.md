
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
