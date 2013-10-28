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
