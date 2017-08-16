import test from 'ava';
import delay from 'delay';
import {Job} from '../../lib';
import {startAgenda, stopAgenda, beforeEach, afterEach} from '../helpers';

test.beforeEach(beforeEach);
test.afterEach.always(afterEach);

test('returns the job', t => {
  const {agenda} = t.context;
  const job = agenda.create('some job', {
    wee: 1
  });

  t.true(job.save() instanceof Job);
});

test('starts/stops the job queue', async t => {
  const {agenda} = t.context;

  await stopAgenda(agenda);

  agenda.define('jobQueueTest', async (job, done) => {
    await stopAgenda(agenda);
    t.pass();
    done();
  });

  agenda.every('1 second', 'jobQueueTest');
  agenda.processEvery('1 second');

  await startAgenda(agenda);
  await delay(1000);
});

test('does not run disabled jobs', t => {
  const {agenda} = t.context;

  agenda.define('disabledJob', () => {
    t.fail();
  });

  const job = agenda.create('disabledJob').disable().schedule('now');

  return new Promise(resolve => {
    job.save(async err => {
      t.ifError(err);

      agenda.start();

      await delay(50);

      t.pass();
      resolve();
    });
  });
});

test('does not throw an error trying to process undefined jobs', async t => {
  const {agenda} = t.context;

  const job = agenda.create('jobDefinedOnAnotherServer').schedule('now');

  await new Promise(resolve => {
    job.save(err => {
      t.ifError(err);
      resolve();
    });
  });

  return new Promise(resolve => {
    agenda.stop(() => resolve());
  });
});

test('clears locks on stop', async t => {
  const {agenda} = t.context;

  agenda.define('longRunningJob', (job, done) => { // eslint-disable-line no-unused-vars
    // Never finishes
  });
  agenda.every('10 seconds', 'longRunningJob');
  agenda.processEvery('1 second');

  await startAgenda(agenda);
  await stopAgenda(agenda);

  return new Promise(resolve => {
    agenda._collection.findOne({name: 'longRunningJob'}, (err, job) => {
      t.ifError(err);

      t.is(job.lockedAt, null);
      resolve();
    });
  });
});
