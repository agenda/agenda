import test from 'ava';
import {Job} from '../../lib';
import {beforeEach, afterEach} from '../helpers/job';

test.beforeEach(beforeEach);
test.afterEach(afterEach);

test('returns the job', t => {
  const {job} = t.context;

  t.true(job.schedule('tomorrow at noon') instanceof Job);
});

test('sets the next run time', t => {
  const {job} = t.context;

  job.schedule('in 5 minutes');

  // @TODO: Add more checks here as this doesn't validate the time/date
  t.true(job.attrs.nextRunAt instanceof Date);
});

test('sets the next run time Date object', t => {
  const {job} = t.context;
  const when = new Date(Date.now() + (1000 * 60 * 3));

  job.schedule(when);

  t.true(job.attrs.nextRunAt instanceof Date);
  t.is(job.attrs.nextRunAt.getTime(), when.getTime());
});
