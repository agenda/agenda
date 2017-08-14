import test from 'ava';
import {Agenda} from '../../lib';
import {beforeEach, afterEach} from '../helpers';

test.beforeEach(beforeEach);
test.afterEach.always(afterEach);

test('returns itself', t => {
  const {agenda} = t.context;

  t.true(agenda.defaultLockLimit(5) instanceof Agenda);
});

test('sets the defaultLockLimit', t => {
  const {agenda} = t.context;

  agenda.defaultLockLimit(1);

  t.is(agenda._defaultLockLimit, 1);
});
