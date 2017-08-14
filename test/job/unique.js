import test from 'ava';
import {Job} from '../../lib';
import {beforeEach, afterEach} from '../helpers/job';

test.beforeEach(beforeEach);
test.afterEach(afterEach);

test('returns the job', t => {
  const {job} = t.context;

  t.true(job.unique({'data.type': 'active', 'data.userId': '123'}) instanceof Job);
});

test('sets the unique property', t => {
  const {job} = t.context;

  job.unique({'data.type': 'active', 'data.userId': '123'});

  t.deepEqual(job.attrs.unique, {'data.type': 'active', 'data.userId': '123'});
});
