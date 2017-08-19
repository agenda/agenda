import test from 'ava';
import {Job} from '../../lib';
import {beforeEach, afterEach} from '../helpers';

test.beforeEach(beforeEach);
test.afterEach.always(afterEach);

test('emits start event', t => {
  const {agenda} = t.context;
  const job = new Job({agenda, name: 'jobQueueTest'});

  return new Promise(resolve => {
    agenda.once('start', j => {
      t.is(j, job);
      resolve();
    });

    job.run();
  });
});

test('emits start:job name event', t => {
  const {agenda} = t.context;
  const job = new Job({agenda, name: 'jobQueueTest'});

  return new Promise(resolve => {
    agenda.once('start:jobQueueTest', j => {
      t.is(j, job);
      resolve();
    });

    job.run();
  });
});

test('emits complete event', t => {
  const {agenda} = t.context;
  const job = new Job({agenda, name: 'jobQueueTest'});

  return new Promise(resolve => {
    agenda.once('complete', j => {
      t.is(job.attrs._id.toString(), j.attrs._id.toString());
      resolve();
    });

    job.run();
  });
});

test('emits complete:job name event', t => {
  const {agenda} = t.context;
  const job = new Job({agenda, name: 'jobQueueTest'});

  return new Promise(resolve => {
    agenda.once('complete:jobQueueTest', j => {
      t.is(job.attrs._id.toString(), j.attrs._id.toString());
      resolve();
    });
    job.run();
  });
});

test('emits success event', t => {
  const {agenda} = t.context;
  const job = new Job({agenda, name: 'jobQueueTest'});

  return new Promise(resolve => {
    agenda.once('success', job => {
      t.truthy(job);
      resolve();
    });

    job.run(err => {
      t.ifError(err);
    });
  });
});

test('emits success:job name event', t => {
  const {agenda} = t.context;
  const job = new Job({agenda, name: 'jobQueueTest'});

  return new Promise(resolve => {
    agenda.once('success:jobQueueTest', job => {
      t.truthy(job);
      resolve();
    });

    job.run(err => {
      t.ifError(err);
    });
  });
});

test('emits fail event', t => {
  const {agenda} = t.context;
  const job = new Job({agenda, name: 'failBoat'});

  return new Promise(resolve => {
    agenda.once('fail', (err, j) => {
      t.is(err.message, 'Zomg fail');
      t.is(j, job);
      t.is(j.attrs.failCount, 1);
      t.true(j.attrs.failedAt.valueOf() >= j.attrs.lastFinishedAt.valueOf());

      agenda.once('fail', (err, j) => {
        if (err) {
          // Expect fail
        }
        t.is(j, job);
        t.is(j.attrs.failCount, 2);
        resolve();
      });
      job.run();
    });

    job.run();
  });
});

test('emits fail:job name event', t => {
  const {agenda} = t.context;
  const job = new Job({agenda, name: 'failBoat'});

  return new Promise(resolve => {
    agenda.once('fail:failBoat', (err, job) => {
      t.is(err.message, 'Zomg fail');
      t.truthy(job);
      resolve();
    });

    job.run();
  });
});
