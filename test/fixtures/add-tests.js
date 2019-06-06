'use strict';
module.exports = {
  none: () => {},
  daily: agenda => {
    agenda.define('once a day test job', (job, done) => {
      process.send('ran');
      done();
      process.exit(0); // eslint-disable-line unicorn/no-process-exit
    });

    agenda.every('one day', 'once a day test job');
  },
  'daily-array': agenda => {
    agenda.define('daily test 1', (job, done) => {
      process.send('test1-ran');
      done();
    });

    agenda.define('daily test 2', (job, done) => {
      process.send('test2-ran');
      done();
    });

    agenda.every('one day', ['daily test 1', 'daily test 2']);
  },
  'define-future-job': agenda => {
    const future = new Date();
    future.setDate(future.getDate() + 1);

    agenda.define('job in the future', (job, done) => {
      process.send('ran');
      done();
      process.exit(0); // eslint-disable-line unicorn/no-process-exit
    });

    agenda.schedule(future, 'job in the future');
  },
  'define-past-due-job': agenda => {
    const past = new Date();
    past.setDate(past.getDate() - 1);

    agenda.define('job in the past', (job, done) => {
      process.send('ran');
      done();
      process.exit(0); // eslint-disable-line unicorn/no-process-exit
    });

    agenda.schedule(past, 'job in the past');
  },
  'schedule-array': agenda => {
    const past = new Date();
    past.setDate(past.getDate() - 1);

    agenda.define('scheduled test 1', (job, done) => {
      process.send('test1-ran');
      done();
    });

    agenda.define('scheduled test 2', (job, done) => {
      process.send('test2-ran');
      done();
    });

    agenda.schedule(past, ['scheduled test 1', 'scheduled test 2']);
  },
  now: agenda => {
    agenda.define('now run this job', (job, done) => {
      process.send('ran');
      done();
      process.exit(0); // eslint-disable-line unicorn/no-process-exit
    });

    agenda.now('now run this job');
  }
};
