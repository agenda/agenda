import test from 'ava';
import {Job} from '../../lib';
import {beforeEach, afterEach} from '../helpers';

test.beforeEach(beforeEach);
test.afterEach.always(afterEach);

test('returns the job', t => {
  const job = new Job({disabled: true});

  t.true(job.enable() instanceof Job);
});

test('sets disabled to false on the job', t => {
  const job = new Job({disabled: true});

  job.enable();

  t.false(job.attrs.disabled);
});
