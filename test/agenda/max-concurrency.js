import test from 'ava';
import {Agenda} from '../../lib';
import {beforeEach, afterEach} from '../helpers/agenda';

test.beforeEach(beforeEach);
test.afterEach.always(afterEach);

test('returns itself', t => {
  const {agenda} = t.context;

  t.true(agenda.maxConcurrency(10) instanceof Agenda);
});

test('sets the maxConcurrency', t => {
  const {agenda} = t.context;

  agenda.maxConcurrency(10);

  t.is(agenda._maxConcurrency, 10);
});
