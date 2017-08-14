import test from 'ava';
import Job from '../../lib/job';
import {beforeEach, afterEach} from '../helpers';

test.beforeEach(beforeEach);
test.afterEach.always(afterEach);

test.cb('returns jobs', t => {
  const {agenda} = t.context;
  const job = agenda.create('test');

  job.save(() => {
    agenda.jobs({}, (err, c) => {
      t.ifError(err);

      t.true(c.length !== 0);
      t.true(c[0] instanceof Job);
      t.end();
    });
  });
});
