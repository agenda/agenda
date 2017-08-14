import test from 'ava';
import Job from '../../lib/job';
import {beforeEach, afterEach} from '../helpers';

test.beforeEach(beforeEach);
test.afterEach.always(afterEach);

test('returns a job', t => {
  const {agenda} = t.context;

  const job = agenda.now('send email');

  t.true(job instanceof Job);
});

test('sets the schedule', t => {
  const {agenda} = t.context;
  const now = new Date();

  t.true(agenda.now('send email').attrs.nextRunAt.valueOf() > now.valueOf() - 1);
});

test.cb('runs the job immediately', t => {
  const {agenda} = t.context;

  agenda.define('immediateJob', job => {
    t.true(job.isRunning());
    t.end();
  });

  agenda.stop();
  agenda.now('immediateJob');
  agenda.start();
});
