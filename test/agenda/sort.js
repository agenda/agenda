import test from 'ava';
import {Agenda} from '../../lib';
import {beforeEach, afterEach} from '../helpers';

test.beforeEach(beforeEach);
test.afterEach.always(afterEach);

test('returns itself', t => {
  const {agenda} = t.context;

  t.true(agenda.sort({nextRunAt: 1, priority: -1}) instanceof Agenda);
});

test('sets the default sort option', t => {
  const {agenda} = t.context;

  agenda.sort({nextRunAt: -1});

  t.deepEqual(agenda._sort, {nextRunAt: -1});
});
