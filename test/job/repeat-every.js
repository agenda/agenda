import test from 'ava';
import {Job} from '../../lib';
import {beforeEach, afterEach} from '../helpers/job';

test.beforeEach(beforeEach);
test.afterEach(afterEach);

test('returns the job', t => {
  const {job} = t.context;

  t.true(job.repeatEvery('one second') instanceof Job);
});

test('sets the repeat interval', t => {
  const {job} = t.context;

  job.repeatEvery(5000);

  t.is(job.attrs.repeatInterval, 5000);
});
