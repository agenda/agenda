import test from 'ava';
import {Job} from '../lib';
import {beforeEach, afterEach} from './helpers';

test.beforeEach(beforeEach);
test.afterEach.always(afterEach);

test('returns itself', t => {
  const {job} = t.context;

  t.true(job instanceof Job);
});
