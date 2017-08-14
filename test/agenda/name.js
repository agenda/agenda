import test from 'ava';
import {Agenda} from '../../lib';
import {beforeEach, afterEach} from '../helpers';

test.beforeEach(beforeEach);
test.afterEach.always(afterEach);

test('returns itself', t => {
  const {agenda} = t.context;

  t.true(agenda.name('test queue') instanceof Agenda);
});

test('sets the agenda name', t => {
  const {agenda} = t.context;

  agenda.name('test queue');

  t.is(agenda._name, 'test queue');
});
