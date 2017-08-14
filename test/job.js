import test from 'ava';
import {Job} from '../lib';

test('returns itself', t => {
  const job = new Job();

  t.true(job instanceof Job);
});
