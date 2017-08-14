import test from 'ava';
import delay from 'delay';
import {Agenda, Job} from '../../lib';
import {beforeEach, afterEach} from '../helpers';

test.beforeEach(beforeEach);
test.afterEach.always(afterEach);

test('returns a job', t => {
  const {agenda} = t.context;

  t.true(agenda.every('5 minutes', 'send email') instanceof Job);
});

test('returns an array of jobs', t => {
  const {agenda} = t.context;

  t.true(Array.isArray(agenda.every('5 minutes', ['send email', 'some job'])));
  t.is(agenda.every('5 minutes', ['send email', 'some job']).length, 2);
  t.true(agenda.every('5 minutes', ['send email', 'some job'])[1] instanceof Job);
  t.true(agenda.every('5 minutes', ['send email', 'some job'])[1] instanceof Job);
});

test('sets the repeatEvery', t => {
  const {agenda} = t.context;

  t.is(agenda.every('5 seconds', 'send email').attrs.repeatInterval, '5 seconds');
});

test('sets the agenda', t => {
  const {agenda} = t.context;

  t.deepEqual(agenda.every('5 seconds', 'send email').agenda, agenda);
  t.true(agenda.every('5 seconds', 'send email').agenda instanceof Agenda);
});

test('should update a job that was previously scheduled with `every`', async t => {
  const {agenda} = t.context;

  agenda.every(10, 'shouldBeSingleJob');
  await delay(10);

  agenda.every(20, 'shouldBeSingleJob');

  return new Promise(resolve => {
    agenda.jobs({name: 'shouldBeSingleJob'}, (err, res) => {
      t.ifError(err);

      t.is(res.length, 1);
      resolve();
    });
  });
});
