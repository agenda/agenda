import test from 'ava';
import delay from 'delay';
import {Job} from '../../lib';
import {beforeEach, afterEach} from '../helpers';

test.beforeEach(beforeEach);
test.afterEach.always(afterEach);

test('returns nothing', t => {
  const {job} = t.context;

  t.is(job.touch(), undefined);
});

test('extends the lock lifetime', async t => {
  const {agenda} = t.context;
  const lockedAt = new Date();
  const job = new Job({agenda, name: 'some job', lockedAt});

  job.save = cb => cb();

  await delay(2);

  await new Promise(resolve => {
    job.touch(() => resolve());
  });

  t.true(job.attrs.lockedAt > lockedAt);
});
