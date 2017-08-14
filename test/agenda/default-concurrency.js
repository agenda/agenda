import test from 'ava';
import {Agenda} from '../../lib';
import {beforeEach, afterEach} from '../helpers/agenda';

test.beforeEach(beforeEach);
test.afterEach.always(afterEach);

test('returns itself', t => {
  const {agenda} = t.context;

  t.true(agenda.defaultConcurrency(5) instanceof Agenda);
});

test('sets the defaultConcurrency', t => {
  const {agenda} = t.context;

  agenda.defaultConcurrency(1);

  t.is(agenda._defaultConcurrency, 1);
});
