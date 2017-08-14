import test from 'ava';
import {beforeEach, afterEach} from '../helpers';

test.beforeEach(beforeEach);
test.afterEach.always(afterEach);

test('returns nothing', t => {
  const {agenda} = t.context;

  t.is(agenda.purge(), undefined);
});

test.cb('removes all agenda without definitions', t => {
  const {agenda} = t.context;
  const job = agenda.create('no definition');

  agenda.stop(() => {
    job.save(() => {
      agenda.jobs({
        name: 'no definition'
      }, (err, j) => {
        t.ifError(err);
        t.is(j.length, 1);
        agenda.purge(err => {
          t.ifError(err);
          agenda.jobs({
            name: 'no definition'
          }, (err, j) => { // eslint-disable-line max-nested-callbacks
            t.ifError(err);
            t.is(j.length, 0);
            t.end();
          });
        });
      });
    });
  });
});
