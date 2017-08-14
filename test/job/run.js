import test from 'ava';
import delay from 'delay';
import Q from 'q';
import {Job} from '../../lib';
import {beforeEach, afterEach} from '../helpers';

test.beforeEach(beforeEach);
test.afterEach(afterEach);

test('returns nothing', t => {
  const {job} = t.context;

  t.is(job.run(), undefined);
});

test('updates lastRunAt', async t => {
  const {job} = t.context;
  const now = new Date();

  await delay(5);

  await new Promise(resolve => {
    job.run(() => resolve());
  });

  t.true(job.attrs.lastRunAt.valueOf() > now.valueOf());
});

test('updates nextRunAt', async t => {
  const {job} = t.context;
  const now = new Date();

  job.repeatEvery('10 minutes');

  await delay(5);

  await new Promise(resolve => {
    job.run(() => resolve());
  });

  t.true(job.attrs.nextRunAt.valueOf() > (now.valueOf() + 59999));
});

test('fails if job is undefined', async t => {
  const {agenda} = t.context;
  const job = new Job({agenda, name: 'not defined'});

  await new Promise(resolve => {
    job.run(() => {
      resolve();
    });
  });

  t.truthy(job.attrs.failedAt);
  t.is(job.attrs.failReason, 'Undefined job');
});

test('handles errors', t => {
  const {job, agenda} = t.context;

  job.attrs.name = 'failBoat';

  agenda.define('failBoat', () => {
    throw new Error('Zomg fail');
  });

  return new Promise(resolve => {
    job.run(err => {
      t.true(err instanceof Error);
      t.is(err.message, 'Zomg fail');

      resolve();
    });
  });
});

test('handles errors with q promises', t => {
  const {job, agenda} = t.context;

  job.attrs.name = 'failBoat2';

  agenda.define('failBoat2', (job, cb) => {
    Q.delay(100).then(() => {
      throw new Error('Zomg fail');
    }).fail(cb).done();
  });

  return new Promise(resolve => {
    job.run(err => {
      t.true(err instanceof Error);
      t.is(err.message, 'Zomg fail');

      resolve();
    });
  });
});

test(`doesn't allow a stale job to be saved`, async t => {
  const {job, agenda} = t.context;

  job.attrs.name = 'failBoat3';

  await new Promise(resolve => {
    job.save(err => {
      t.ifError(err);

      resolve();
    });
  });

  agenda.define('failBoat3', (job, cb) => {
    // Explicitly find the job again,
    // so we have a new job object
    agenda.jobs({name: 'failBoat3'}, (err, job) => {
      t.ifError(err);
      job[0].remove(err => {
        t.ifError(err);
        cb();
      });
    });
  });

  await new Promise(resolve => {
    job.run(err => {
      t.ifError(err);
      resolve();
    });
  });

  await new Promise(resolve => {
    // Expect the deleted job to not exist in the database
    agenda.jobs({name: 'failBoat3'}, (err, job) => {
      t.ifError(err);
      t.is(job.length, 0);

      resolve();
    });
  });
});
