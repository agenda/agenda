import test from 'ava';
import {Job} from '../../lib';
import {beforeEach, afterEach} from '../helpers';

test.beforeEach(beforeEach);
test.afterEach.always(afterEach);

test('returns a job', t => {
  const {agenda} = t.context;

  t.true(agenda.create('sendEmail', {to: 'some guy'}) instanceof Job);
});

test('stores the definition for the job', t => {
  const {agenda, jobProcessor} = t.context;

  t.is(agenda._definitions.someJob.fn, jobProcessor);
});

test('sets the default concurrency for the job', t => {
  const {agenda} = t.context;

  t.is(agenda._definitions.someJob.concurrency, 5);
});

test('sets the default lockLimit for the job', t => {
  const {agenda} = t.context;

  t.is(agenda._definitions.someJob.lockLimit, 0);
});

test('sets the default priority for the job', t => {
  const {agenda} = t.context;

  t.is(agenda._definitions.someJob.priority, 0);
});

test('takes concurrency option for the job', t => {
  const {agenda, jobProcessor} = t.context;

  agenda.define('highPriority', {priority: 10}, jobProcessor);

  t.is(agenda._definitions.highPriority.priority, 10);
});
