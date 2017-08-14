import test from 'ava';
import {Job} from '../../lib';
import {beforeEach, afterEach} from '../helpers';

test.beforeEach(beforeEach);
test.afterEach(afterEach);

test('returns the job', t => {
  const job = new Job();

  t.true(job.disable() instanceof Job);
});

test('sets disabled to false on the job', t => {
  const job = new Job();

  job.disable();

  t.true(job.attrs.disabled);
});
