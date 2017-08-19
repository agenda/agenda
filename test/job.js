import test from 'ava';
import {Job} from '../lib';
import {beforeEach, afterEach, startAgenda} from './helpers';

test.beforeEach(beforeEach);
test.afterEach.always(afterEach);

test('returns itself', t => {
  const {job} = t.context;

  t.true(job instanceof Job);
});

test('should retry a job', t => {
  const {agenda} = t.context;
  let shouldFail = true;

  agenda.define('a job', (job, done) => {
    if (shouldFail) {
      shouldFail = false;
      return done(new Error('test failure'));
    }
    done();
  });

  agenda.on('fail:a job', (err, job) => {
    t.is(err.message, 'test failure');
    job.schedule('now').save();
  });

  return new Promise(async resolve => {
    agenda.on('success:a job', () => {
      t.pass();
      resolve();
    });

    agenda.now('a job');

    await startAgenda(agenda);
  });
});
