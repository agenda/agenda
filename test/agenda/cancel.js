import test from 'ava';
import {beforeEach, afterEach} from '../helpers';

test.beforeEach(beforeEach);
test.afterEach.always(afterEach);

test('returns nothing', t => {
  const {agenda} = t.context;

  t.is(agenda.cancel('jobA'), undefined);
});

const createJobs = t => {
  const {agenda} = t.context;
  return new Promise(resolve => {
    let remaining = 3;
    const checkDone = err => {
      t.ifError(err);
      remaining--;
      if (!remaining) {
        resolve();
      }
    };
    agenda.create('jobA').save(checkDone);
    agenda.create('jobA', 'someData').save(checkDone);
    agenda.create('jobB').save(checkDone);
  });
};

test('should cancel a job', async t => {
  const {agenda} = t.context;

  await createJobs(t);

  return new Promise(resolve => {
    agenda.jobs({name: 'jobA'}, (err, j) => {
      t.ifError(err);
      t.is(j.length, 2);

      agenda.cancel({name: 'jobA'}, err => {
        t.ifError(err);

        agenda.jobs({name: 'jobA'}, (err, j) => {
          t.ifError(err);

          t.is(j.length, 0);
          resolve();
        });
      });
    });
  });
});

test('should cancel multiple agenda', async t => {
  const {agenda} = t.context;

  await createJobs(t);

  return new Promise(resolve => {
    agenda.jobs({name: {$in: ['jobA', 'jobB']}}, (err, j) => {
      t.ifError(err);
      t.is(j.length, 3);

      agenda.cancel({name: {$in: ['jobA', 'jobB']}}, err => {
        t.ifError(err);

        agenda.jobs({name: {$in: ['jobA', 'jobB']}}, (err, j) => {
          t.ifError(err);

          t.is(j.length, 0);
          resolve();
        });
      });
    });
  });
});

test('should cancel agenda only if the data matches', async t => {
  const {agenda} = t.context;

  await createJobs(t);

  return new Promise(resolve => {
    agenda.jobs({name: 'jobA', data: 'someData'}, (err, j) => {
      t.ifError(err);
      t.is(j.length, 1);

      agenda.cancel({name: 'jobA', data: 'someData'}, err => {
        t.ifError(err);

        agenda.jobs({name: 'jobA', data: 'someData'}, (err, j) => {
          t.ifError(err);
          t.is(j.length, 0);

          agenda.jobs({name: 'jobA'}, (err, j) => {
            t.ifError(err);
            t.is(j.length, 1);
            resolve();
          });
        });
      });
    });
  });
});
