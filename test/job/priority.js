import test from 'ava';
import {Job} from '../../lib';
import {beforeEach, afterEach} from '../helpers';

test.beforeEach(beforeEach);
test.afterEach(afterEach);

test('returns the job', t => {
  const {job} = t.context;

  t.true(job.priority(50) instanceof Job);
});

test('sets the priority to a number', t => {
  const {job} = t.context;

  job.priority(10);

  t.is(job.attrs.priority, 10);
});

test('parses written priorities', t => {
  const {job} = t.context;

  job.priority('high');

  t.is(job.attrs.priority, 10);
});
