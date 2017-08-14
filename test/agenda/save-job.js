import test from 'ava';
import {Job} from '../../lib';
import {beforeEach, afterEach} from '../helpers';

test.beforeEach(beforeEach);
test.afterEach.always(afterEach);

test('returns a job', t => {
  const {agenda} = t.context;

  const job = agenda.create('someJob', {});

  t.true(job.save() instanceof Job);
});

test('persists job to the database', t => {
  const {agenda} = t.context;
  const job = agenda.create('someJob', {});

  return new Promise(resolve => {
    job.save((err, job) => {
      t.ifError(err);

      t.truthy(job.attrs._id);
      resolve();
    });
  });
});
