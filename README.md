# Agenda
Agenda is a light-weight job scheduling library for Node.js. 

It offers:

- Minimal overhead. Agenda aims to keep its code base small.
- Mongo backed persistance layer.
- Scheduling with priority, repeating, and easily readable syntax.

## Installation

Install via NPM

    npm install agenda

## Example Usage

```js
  var agenda = new Agenda({db: { address: 'localhost:27017/agenda-example'}});

  agenda.define('delete old users', function(job, done) {
    User.remove({lastLogIn: { $lt: twoDaysAgo }}, done);
  });
  
  agenda.every('3 minutes', 'delete old users');

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
  agenda.schedule('Saturday at noon', 'send email report', {to: 'another-guy@example.com'});

```

## Full documentation

Agenda's basic control structure is an instance of an agenda. Agenda's are
mapped to a database collection and load the jobs from within.


### Defining Job Processors

Before you can use a job, you must define its processing behavior.

##### define(jobName, [options], fn)

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


### Configuring an agenda

All configuration methods are chainable, meaning you can do something like:

```js
var agenda = new Agenda();
agenda
  .database(...)
  .processEvery('3 minutes')
  ...;
```

##### database(url, [collectionName])

Specifies the database at the `url` specified. If no collection name is give,
`agendaJobs` is used.

```js
agenda.database('localhost:27017/agenda-test', 'agendaJobs');
```

You can also specify it during instantiation.

```js
var agenda = new Agenda({db: { address: 'localhost:27017/agenda-test', collection: 'agendaJobs' }});
```

##### processEvery(interval)

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

##### maxConcurrency(number)

Takes a `number` which specifies the max number of jobs that can be running at
any given moment. By default it is `20`.

```js
agenda.maxConcurrency(20);
```

You can also specify it during instantiation

```js
var agenda = new Agenda({processEvery: 20});
```

##### defaultConcurrency(number)

Takes a `number` which specifies the default number of a specific that can be running at
any given moment. By default it is `5`.

```js
agenda.defaultConcurrency(5);
```

You can also specify it during instantiation

```js
var agenda = new Agenda({defaultConcurrency: 5});
```




## License
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
