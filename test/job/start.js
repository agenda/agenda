import test from 'ava';
import {Job} from '../../lib';
import {startAgenda, stopAgenda, clearJobs, beforeEach, afterEach} from '../helpers';

test.beforeEach(beforeEach);
test.afterEach.always(afterEach);

test('returns the job', t => {
  const {agenda} = t.context;
  const job = agenda.create('some job', {
    wee: 1
  });

  t.true(job.save() instanceof Job);
});

test('starts/stops the job queue', t => {
  const {agenda} = t.context;

  return new Promise(async resolve => {
    agenda.define('jobQueueTest', async (job, done) => {
      done();

      await stopAgenda(agenda);
      t.true(agenda._processInterval === undefined);
      await clearJobs(agenda);

      resolve();
    });
    agenda.every('1 second', 'jobQueueTest');
    agenda.processEvery('1 second');

    await startAgenda(agenda);
    t.truthy(agenda._processInterval);
  });
});

test('does not run disabled jobs', async t => {
  const {agenda} = t.context;

  agenda.define('disabledJob', (job, done) => {
    t.fail();
    done();
  });

  const job = agenda.create('disabledJob').disable().schedule('now');

  await new Promise(resolve => {
    job.save((err, job) => {
      t.ifError(err);
      resolve(job);
    });
  });

  await new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, 1500);
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
});

test('clears locks on stop', async t => {
  const {agenda} = t.context;

  agenda.define('longRunningJob', (job, done) => { // eslint-disable-line no-unused-vars
    // Never finishes
  });
  agenda.every('10 seconds', 'longRunningJob');

  await new Promise(resolve => {
    setTimeout(async () => {
      resolve();
    }, 1500);
  });

  await new Promise(resolve => {
    agenda._collection.findOne({name: 'longRunningJob'}, (err, job) => {
      t.ifError(err);

      t.truthy(job.lockedAt);
      resolve();
    });
  });

  await stopAgenda(agenda);

  await new Promise(resolve => {
    agenda._collection.findOne({name: 'longRunningJob'}, (err, job) => {
      t.ifError(err);

      t.is(job.lockedAt, null);
      resolve();
    });
  });
});
