# Agenda
Agenda is a light-weight job scheduling library for Node.js. 

It offers:

- Minimal overhead. Agenda aims to keep its code base small.
- Mongo backed persistance layer.
- Scheduling with priority, repeating, and easily readable syntax.

# Installation

Install via NPM

    npm install agenda

# Example Usage

```js
var agenda = new Agenda({db: { address: 'localhost:27017/agenda-example'}});

agenda.define('delete old users', function(job, done) {
  User.remove({lastLogIn: { $lt: twoDaysAgo }}, done);
});

agenda.every('3 minutes', 'delete old users');
```

```js
agenda.define('send email report', {priority: 'high', concurrency: 10}, function(job, done) {
  var data = job.attrs.data;
  emailClient.send({ 
    to: data.to,
    from: 'example@example.com',
    subject: 'Email Report',
    body: '...'
  }
});

agenda.schedule('in 20 minutes', 'send email report', {to: 'admin@example.com'});
```

```js
var weeklyReport = agenda.schedule('Saturday at noon', 'send email report', {to: 'another-guy@example.com'});
weeklyReport.repeatEvery('1 week').save();
```

# Full documentation

Agenda's basic control structure is an instance of an agenda. Agenda's are
mapped to a database collection and load the jobs from within.

## Table of Contents
- [Configuring an agenda](#configuring-an-agenda)
- [Defining job processors](#defining-job-processors)
- [Creating jobs](#creating-jobs)
- [Manually working with jobs](#manually-working-with-a-job)

## Configuring an agenda 
All configuration methods are chainable, meaning you can do something like:

```js
var agenda = new Agenda();
agenda
  .database(...)
  .processEvery('3 minutes')
  ...;
```

### database(url, [collectionName])

Specifies the database at the `url` specified. If no collection name is give,
`agendaJobs` is used.

```js
agenda.database('localhost:27017/agenda-test', 'agendaJobs');
```

You can also specify it during instantiation.

```js
var agenda = new Agenda({db: { address: 'localhost:27017/agenda-test', collection: 'agendaJobs' }});
```

### processEvery(interval)

Takes a string `interval` which can be either a traditional javascript number,
or a string such as `3 minutes`

Specifies the frequency at which agenda will query the database looking for jobs
that need to be processed. If your jobs are time sensitive, you will want to
specify a low value.

```js
agenda.processEvery('1 minute');
```

You can also specify it during instantiation

```js
var agenda = new Agenda({processEvery: '30 seconds'});
```

### maxConcurrency(number)

Takes a `number` which specifies the max number of jobs that can be running at
any given moment. By default it is `20`.

```js
agenda.maxConcurrency(20);
```

You can also specify it during instantiation

```js
var agenda = new Agenda({processEvery: 20});
```

### defaultConcurrency(number)

Takes a `number` which specifies the default number of a specific that can be running at
any given moment. By default it is `5`.

```js
agenda.defaultConcurrency(5);
```

You can also specify it during instantiation

```js
var agenda = new Agenda({defaultConcurrency: 5});
```


## Defining Job Processors

Before you can use a job, you must define its processing behavior.

### define(jobName, [options], fn)

Defines a job with the name of `jobName`. When a job of job name gets run, it
will be passed to `fn(job, done)`. To maintain asynchronous behavior, you must
call `done()` when you are processing the job.

`options` is an optional argument which can overwrite the defaults. It can take
the following:

- `concurrency`: `number` maxinum number of that job that can be running at once
- `priority`: `(lowest|low|normal|high|highest|number)` specifies the priority
  of the job. Higher priority jobs will run first. See the priority mapping
  below

Priority mapping:
```
{
  highest: 20,
  high: 10,
  default: 0,
  low: -10,
  lowest: -20
}
```

## Creating Jobs

### every(interval, name, [data])

Runs job `name` at the given `interval`. Optionally, data can be passed in.
Every creates a job of type `single`, which means that it will only create one
job in the database, even if that line is run multiple times. This lets you put
it in a file that may get run multiple times, such as `webserver.js` which may
reboot from time to time.

`data` is an optional argument that will be passed to the processing function
under `job.data`.

Returns the `job`.

```js
agenda.define('printAnalyticsReport', function(job, done) {
  User.doSomethingReallyIntensive(function(err, users) {
    processUserData();
    console.log("I print a report!");
    done();
  });
});

agenda.every('15 minutes', 'printAnalyticsReport');
```

### schedule(when, name, data)

Schedules a job to run `name` once at a given time. `when` can be a `Date` or a
`String` such as `tomorrow at 5pm`.

`data` is an optional argument that will be passed to the processing function
under `job.data`.

Returns the `job`.


```js
agenda.schedule('tomorrow at noon', 'printAnalyticsReport', {userCount: 100});
```

### create(jobName, data)

Returns an instance of a `jobName` with `data`. This does *NOT* save the job in
the database. See below to learn how to manually work with jobs.

```js
var job = agenda.create('printAnalyticsReport', {userCount: 100});
job.save();
```

## Manually working with a job

A job instance has many instance methods. All mutating methods must be followed
with a call to `job.save()` in order to persist the changes to the database.


### repeatEvery(interval)

Specifies an `interval` on which the job should repeat.

```js
job.repeatEvery('10 minutes');
job.save();
```

### schedule(time)

Specifies the next `time` at which the job should repeat.

```js
job.schedule('tomorrow at 6pm');
job.save();
```

### priority(priority)

Specifies the `priority` weighting of the job. Can be a number or a string from
the above priority table.

```js
job.priority('low');
job.save();
```

### fail(reason)

Sets `job.attrs.failedAt` to `now`, and sets `job.attrs.failReason`
to `reason`.

```js
job.fail('insuficient disk space');
job.save();
```

### run(callback)

Runs the given `job` and calls `callback(err, job)` upon completion. Normally
you never need to call this manually.

```js
job.run(function(err, job) {
  console.log("I don't know why you would need to do this...");
});
```

### save(callback)

Saves the `job.attrs` into the database.

```js
job.save()
```




# License
(The MIT License)

Copyright (c) 2013 Ryan Schmukler <ryan@slingingcode.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the 'Software'), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
