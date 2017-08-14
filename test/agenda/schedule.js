import test from 'ava';
import {Job} from '../../lib';
import {beforeEach, afterEach} from '../helpers/agenda';

test.beforeEach(beforeEach);
test.afterEach.always(afterEach);

test('returns a job', t => {
  const {agenda} = t.context;

  t.true(agenda.schedule('in 5 minutes', 'send email') instanceof Job);
});

test('returns an array of jobs', t => {
  const {agenda} = t.context;

  const jobs = agenda.schedule('in 5 minutes', ['send email', 'some other job']);

  t.true(Array.isArray(jobs));
  t.is(jobs.length, 2);
  t.true(jobs[0] instanceof Job);
  t.true(jobs[1] instanceof Job);
});

test('sets the schedule', t => {
  const {agenda} = t.context;
  const fiveish = (new Date()).valueOf() + 250000;

  t.true(agenda.schedule('in 5 minutes', 'send email').attrs.nextRunAt.valueOf() > fiveish);
});
