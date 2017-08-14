import test from 'ava';
import {Job} from '../../lib';
import {beforeEach, afterEach} from '../helpers';

test.beforeEach(beforeEach);
test.afterEach(afterEach);

test('returns the job', t => {
  const {agenda} = t.context;
  const job = agenda.create('some job', {
    wee: 1
  });

  t.true(job.save() instanceof Job);
});

test.cb('calls saveJob on the agenda', t => {
  const {agenda} = t.context;
  const oldSaveJob = agenda.saveJob;

  agenda.saveJob = () => {
    agenda.saveJob = oldSaveJob;
    t.end();
  };

  const job = agenda.create('some job', {
    wee: 1
  });
  job.save();
});

test('doesnt save the job if its been removed', async t => {
  const {agenda} = t.context;
  const job = agenda.create('another job');

  // Save, then remove, then try and save again.
  // The second save should fail.
  await new Promise(resolve => {
    job.save(() => {
      resolve();
    });
  });

  await new Promise(resolve => {
    job.remove(() => {
      resolve();
    });
  });

  await new Promise(resolve => {
    job.save(() => {
      resolve();
    });
  });

  return new Promise(resolve => {
    agenda.jobs({name: 'another job'}, (err, jobs) => {
      t.ifError(err);

      t.is(jobs.length, 0);
      resolve();
    });
  });
});
