import {promisify} from 'util';
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
    t.true(agenda._processInterval);
  });
});

test.skip('does not run disabled jobs', async t => {
  const {agenda} = t.context;

  await stopAgenda(agenda);
  await clearJobs(agenda);

  agenda.define('disabledJob', (job, done) => {
    t.fail();
    done();
  });

  const job = agenda.create('disabledJob').disable().schedule('now');

  const {lastRunAt} = promisify(job.save)().then(job => job.attrs);

  await startAgenda(agenda);

  t.true(lastRunAt === undefined);
});

test.skip('does not throw an error trying to process undefined jobs', async t => {
  const {agenda} = t.context;

  const job = agenda.create('jobDefinedOnAnotherServer').schedule('now');

  await new Promise(resolve => {
    job.save(err => {
      t.ifError(err);
      t.pass();
      resolve();
    });
  });

  await stopAgenda(agenda);
});

test.skip('clears locks on stop', async t => {
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
