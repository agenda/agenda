import test from 'ava';
import {Agenda} from '../lib';
import {beforeEach, afterEach} from './helpers';

test.beforeEach(beforeEach);
test.afterEach.always(afterEach);

test('returns itself', t => {
  const {agenda} = t.context;

  t.true(agenda instanceof Agenda);
});

test('sets a default processEvery', t => {
  const {agenda} = t.context;

  t.is(agenda._processEvery, 5000);
});
