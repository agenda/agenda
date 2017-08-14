import test from 'ava';
import {Job} from '../../lib';
import {beforeEach, afterEach} from '../helpers';

test.beforeEach(beforeEach);
test.afterEach(afterEach);

test('returns the job', t => {
  const {job} = t.context;

  t.true(job.repeatAt('3:30pm') instanceof Job);
});

test('sets the repeat at', t => {
  const {job} = t.context;

  job.repeatAt('3:30pm');

  t.is(job.attrs.repeatAt, '3:30pm');
});
