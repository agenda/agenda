import test from 'ava';
import {Agenda} from '../../lib';
import {beforeEach, afterEach} from '../helpers';

test.beforeEach(beforeEach);
test.afterEach.always(afterEach);

test('returns itself', t => {
  const {agenda} = t.context;

  t.true(agenda.defaultLockLifetime(1000) instanceof Agenda);
});

test('sets the default lock lifetime', t => {
  const {agenda} = t.context;

  agenda.defaultLockLifetime(9999);

  t.is(agenda._defaultLockLifetime, 9999);
});

test('is inherited by agenda', t => {
  const {agenda} = t.context;

  agenda.defaultLockLifetime(7777);
  agenda.define('testDefaultLockLifetime', () => {});

  t.is(agenda._definitions.testDefaultLockLifetime.lockLifetime, 7777);
});
