import test from 'ava';
import {Job} from '../../lib';

test('returns itself', t => {
  const job = new Job();
  t.true(job.repeatAt('3:30pm') instanceof Job);
});

test('sets the repeat at', t => {
  const job = new Job();

  job.repeatAt('3:30pm');

  t.is(job.attrs.repeatAt, '3:30pm');
});
