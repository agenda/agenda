import test from 'ava';
import {beforeEach, afterEach} from '../helpers';

test.beforeEach(beforeEach);
test.afterEach(afterEach);

test('returns the job', t => {
  const {job} = t.context;

  t.is(job.remove(), undefined);
});

test('removes the job', async t => {
  const {job, mongo} = t.context;

  await new Promise(resolve => {
    job.save(err => {
      t.ifError(err);

      resolve();
    });
  });

  await new Promise(resolve => {
    job.remove(err => {
      t.ifError(err);

      resolve();
    });
  });

  return new Promise(resolve => {
    mongo.collection('agendaJobs').find({
      _id: job.attrs._id
    }).toArray((err, job) => {
      t.ifError(err);

      t.is(job.length, 0);
      resolve();
    });
  });
});
