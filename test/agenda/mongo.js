import test from 'ava';
import uuidv4 from 'uuid/v4';
import {MongoClient} from 'mongodb';
import {Agenda} from '../../lib';
import {beforeEach, afterEach} from '../helpers';

test.beforeEach(beforeEach);
test.afterEach.always(t => afterEach(t, false));

test('returns itself', t => {
  const {agenda, mongo} = t.context;

  t.true(agenda.mongo(mongo) instanceof Agenda);
});

test('sets the _db directly', async t => {
  const {agenda, mongoHost, mongoPort} = t.context;
  const databaseName = uuidv4();
  const mongo = await MongoClient.connect(`mongodb://${mongoHost}:${mongoPort}/${databaseName}`);

  return new Promise(resolve => {
    agenda.mongo(mongo, databaseName, () => {
      t.is(agenda._mdb.databaseName, databaseName);
      resolve();
    });
  });
});

test('sets the _db directly when passed as an option', async t => {
  const {mongoHost, mongoPort} = t.context;
  const databaseName = uuidv4();
  const mongo = await MongoClient.connect(`mongodb://${mongoHost}:${mongoPort}/${databaseName}`);
  const agenda = new Agenda({mongo});

  return new Promise(resolve => {
    t.is(agenda._mdb.databaseName, databaseName);
    resolve();
  });
});
