import test from 'ava';
import {Job} from '../../lib';
import {beforeEach, afterEach} from '../helpers';

test.beforeEach(beforeEach);
test.afterEach(afterEach);

test('returns the job', t => {
  const {job} = t.context;

  t.true(job.priority(50) instanceof Job);
});

test('takes a string', t => {
  const {job} = t.context;

  job.fail('test');

  t.is(job.attrs.failReason, 'test');
});

test('takes an error object', t => {
  const {job} = t.context;

  job.fail(new Error('test'));

  t.is(job.attrs.failReason, 'test');
});

test('sets the failedAt time', t => {
  const {job} = t.context;

  job.fail('test');

  // @TODO: Add more checks here as this doesn't validate the time/date
  t.true(job.attrs.failedAt instanceof Date);
});

test('sets the failedAt time equal to lastFinishedAt time', t => {
  const {job} = t.context;

  job.fail('test');

  t.is(job.attrs.failedAt, job.attrs.lastFinishedAt);
});
