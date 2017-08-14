import test from 'ava';
import moment from 'moment-timezone';
import {Job} from '../../lib';
import {beforeEach, afterEach} from '../helpers/job';

test.beforeEach(beforeEach);
test.afterEach(afterEach);

test('returns the job', t => {
  const {job} = t.context;

  t.true(job.computeNextRunAt() instanceof Job);
});

test('sets to undefined if no repeat at', t => {
  const {job} = t.context;

  job.attrs.repeatAt = null;
  job.computeNextRunAt();

  t.is(job.attrs.nextRunAt, undefined);
});

test('it understands repeatAt times', t => {
  const {job} = t.context;
  const now = new Date();

  now.setHours(23);
  now.setMinutes(59);
  now.setSeconds(0);

  job.attrs.repeatAt = '11:59pm';
  job.computeNextRunAt();

  t.is(job.attrs.nextRunAt.getHours(), now.getHours());
  t.is(job.attrs.nextRunAt.getMinutes(), now.getMinutes());
});

test('sets to undefined if no repeat interval', t => {
  const {job} = t.context;

  job.attrs.repeatInterval = null;
  job.computeNextRunAt();

  t.is(job.attrs.nextRunAt, undefined);
});

test('it understands human intervals', t => {
  const {job} = t.context;
  const now = new Date();

  job.attrs.lastRunAt = now;
  job.repeatEvery('2 minutes');
  job.computeNextRunAt();

  t.is(job.attrs.nextRunAt, now.valueOf() + 120000);
});

test('understands cron intervals', t => {
  const {job} = t.context;
  const now = new Date();

  now.setMinutes(1);
  now.setMilliseconds(0);
  now.setSeconds(0);

  job.attrs.lastRunAt = now;
  job.repeatEvery('*/2 * * * *');
  job.computeNextRunAt();

  t.is(job.attrs.nextRunAt.valueOf(), now.valueOf() + 60000);
});

test('understands cron intervals with a timezone', t => {
  const {job} = t.context;
  const date = new Date('2015-01-01T06:01:00-00:00');

  job.attrs.lastRunAt = date;
  job.repeatEvery('0 6 * * *', {
    timezone: 'GMT'
  });
  job.computeNextRunAt();

  t.is(moment(job.attrs.nextRunAt).tz('GMT').hour(), 6);
  t.is(moment(job.attrs.nextRunAt).toDate().getDate(), moment(job.attrs.lastRunAt).add(1, 'days').toDate().getDate());
});

test('understands cron intervals with a timezone when last run is the same as the interval', t => {
  const {job} = t.context;
  const date = new Date('2015-01-01T06:00:00-00:00');

  job.attrs.lastRunAt = date;
  job.repeatEvery('0 6 * * *', {
    timezone: 'GMT'
  });
  job.computeNextRunAt();

  t.is(moment(job.attrs.nextRunAt).tz('GMT').hour(), 6);
  t.is(moment(job.attrs.nextRunAt).toDate().getDate(), moment(job.attrs.lastRunAt).add(1, 'days').toDate().getDate());
});

test('sets nextRunAt to undefined when repeat at time is invalid', t => {
  const {job} = t.context;

  job.attrs.repeatAt = 'foo';
  job.computeNextRunAt();

  t.is(job.attrs.nextRunAt, undefined);
});

test('fails the job when repeat at time is invalid', t => {
  const {job} = t.context;

  job.attrs.repeatAt = 'foo';
  job.computeNextRunAt();

  t.is(job.attrs.failReason, 'failed to calculate repeatAt time due to invalid format');
});

test('sets nextRunAt to undefined when repeat interval is invalid', t => {
  const {job} = t.context;

  job.attrs.repeatInterval = 'asd';
  job.computeNextRunAt();

  t.is(job.attrs.nextRunAt, undefined);
});

test('fails the job when repeat interval is invalid', t => {
  const {job} = t.context;

  job.attrs.repeatInterval = 'asd';
  job.computeNextRunAt();

  t.is(job.attrs.failReason, 'failed to calculate nextRunAt due to invalid repeat interval');
});
