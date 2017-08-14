import test from 'ava';
import {Job} from '../lib';
import {beforeEach, afterEach} from './helpers/job';

test.beforeEach(beforeEach);
test.afterEach(afterEach);

test('returns itself', t => {
  const {job} = t.context;

  t.true(job instanceof Job);
});
