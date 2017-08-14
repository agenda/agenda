import test from 'ava';
import delay from 'delay';
import {Job} from '../../lib';
import {beforeEach, afterEach} from '../helpers/agenda';

test.beforeEach(beforeEach);
test.afterEach.always(afterEach);

test('returns nothing', t => {
  const {agenda} = t.context;

  const job = agenda.create('unique job', {
    type: 'active',
    userId: '123',
    other: true
  }).unique({
    'data.type': 'active',
    'data.userId': '123'
  });

  t.true(job instanceof Job);
});

test('should modify one job when unique matches', async t => {
  const {agenda, mongo} = t.context;

  const job1 = await new Promise(resolve => {
    agenda.create('unique job', {
      type: 'active',
      userId: '123',
      other: true
    }).unique({
      'data.type': 'active',
      'data.userId': '123'
    }).schedule('now').save((err, job) => {
      t.ifError(err);
      resolve(job);
    });
  });

  await delay(1);

  const job2 = await new Promise(resolve => {
    agenda.create('unique job', {
      type: 'active',
      userId: '123',
      other: false
    }).unique({
      'data.type': 'active',
      'data.userId': '123'
    }).schedule('now').save((err, job) => {
      t.ifError(err);
      resolve(job);
    });
  });

  t.true(job1.attrs.nextRunAt.toISOString() !== job2.attrs.nextRunAt.toISOString());

  return new Promise(resolve => {
    mongo.collection('agendaJobs').find({
      name: 'unique job'
    }).toArray((err, job) => {
      t.ifError(err);

      t.is(job.length, 1);
      resolve();
    });
  });
});

test('should not modify job when unique matches and insertOnly is set to true', async t => {
  const {agenda, mongo} = t.context;

  const job1 = await new Promise(resolve => {
    agenda.create('unique job', {
      type: 'active',
      userId: '123',
      other: true
    }).unique({
      'data.type': 'active',
      'data.userId': '123'
    }, {
      insertOnly: true
    }).schedule('now').save((err, job) => {
      t.ifError(err);
      resolve(job);
    });
  });

  const job2 = await new Promise(resolve => {
    agenda.create('unique job', {
      type: 'active',
      userId: '123',
      other: false
    }).unique({
      'data.type': 'active',
      'data.userId': '123'
    }, {
      insertOnly: true
    }).schedule('now').save((err, job) => {
      t.ifError(err);
      resolve(job);
    });
  });

  t.is(job1.attrs.nextRunAt.toISOString(), job2.attrs.nextRunAt.toISOString());

  return new Promise(resolve => {
    mongo.collection('agendaJobs').find({
      name: 'unique job'
    }).toArray((err, job) => {
      t.ifError(err);

      t.is(job.length, 1);
      resolve();
    });
  });
});

test(`should create two agenda when unique doesn't match`, async t => {
  const {agenda, mongo} = t.context;

  const time = new Date(Date.now() + (1000 * 60 * 3));
  const time2 = new Date(Date.now() + (1000 * 60 * 4));

  await new Promise(resolve => {
    agenda.create('unique job', {
      type: 'active',
      userId: '123',
      other: true
    }).unique({
      'data.type': 'active',
      'data.userId': '123',
      nextRunAt: time
    }).schedule(time).save(err => {
      t.ifError(err);
      resolve();
    });
  });

  await new Promise(resolve => {
    agenda.create('unique job', {
      type: 'active',
      userId: '123',
      other: false
    }).unique({
      'data.type': 'active',
      'data.userId': '123',
      nextRunAt: time2
    }).schedule(time).save(err => {
      t.ifError(err);
      resolve();
    });
  });

  return new Promise(resolve => {
    mongo.collection('agendaJobs').find({
      name: 'unique job'
    }).toArray((err, job) => {
      t.ifError(err);

      t.is(job.length, 2);
      resolve();
    });
  });
});
