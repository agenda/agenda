import test from 'ava';
import {Agenda} from '../../lib';
import {beforeEach, afterEach} from '../helpers/agenda';

test.beforeEach(beforeEach);
test.afterEach.always(afterEach);

test('returns itself', t => {
  const {agenda} = t.context;

  t.true(agenda.processEvery('3 minutes') instanceof Agenda);
});

test('sets the processEvery time', t => {
  const {agenda} = t.context;

  agenda.processEvery('3 minutes');

  t.is(agenda._processEvery, 180000);
});
