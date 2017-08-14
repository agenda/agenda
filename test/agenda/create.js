import test from 'ava';
import {Job} from '../../lib';
import {beforeEach, afterEach} from '../helpers/agenda';

test.beforeEach(beforeEach);
test.afterEach.always(afterEach);

test('returns a job', t => {
  const {agenda} = t.context;

  t.true(agenda.create('sendEmail', {to: 'some guy'}) instanceof Job);
});

test('creates a job', t => {
  const {agenda} = t.context;
  const job = agenda.create('sendEmail', {to: 'some guy'});

  t.is(job.attrs.name, 'sendEmail');
  t.is(job.attrs.type, 'normal');
  t.deepEqual(job.agenda, agenda);
  t.is(job.attrs.data.to, 'some guy');
});
