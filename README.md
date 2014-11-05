# agenda-n

Fork from rschmukler's agenda.

Changes:

- `every`: start and end date support for job executions added, jobs created with every will only run in the date-time interval given.
- Configuration file `conf.js` created
- `single` job types: two jobs with same name but different data will generate two separate records.

[![Build Status](https://api.travis-ci.org/elmurci/agenda-n.png)](http://travis-ci.org/elmurci/agenda-n)

# Example Usage

```js

// Would execute "get results" every 3 minutes on 30th October 2014 between 12:00 and 18:00.
agenda.every(
  '3 minutes', 
  'get results', 
  data, 
  '2014-10-30 12:00',
  '2014-10-30 18:00'
);

agenda.start();
```

```js



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
