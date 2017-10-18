import uuidv4 from 'uuid/v4';
import Debug from 'debug';
import {MongoClient} from 'mongodb';
import {Agenda, Job} from '../../lib';

const mongoHost = process.env.MONGODB_HOST || 'localhost';
const mongoPort = process.env.MONGODB_PORT || '27017';
const debug = new Debug('agenda:test:helpers');
const jobProcessor = () => {};

const startAgenda = async agenda => {
  return new Promise(resolve => {
    agenda.on('ready', () => {
      agenda.processEvery(500);
      agenda.start();
      debug('agenda started');
      resolve();
    });
  });
};

const stopAgenda = async agenda => {
  return new Promise(resolve => {
    agenda.stop(() => {
      debug('agenda stopped');
      resolve();
    });
  });
};

const clearJobs = agenda => {
  return new Promise(resolve => {
    debug('jobs cleared');
    agenda._mdb.collection('agendaJobs').remove({}, resolve);
  });
};

const beforeEach = async t => {
  const databaseName = uuidv4();
  const jobTimeout = 500;
  const mongoCfg = `mongodb://${mongoHost}:${mongoPort}/${databaseName}`;
  const agenda = new Agenda({db: {address: mongoCfg}});
  const job = new Job({agenda});
  const mongo = await MongoClient.connect(mongoCfg);

  await startAgenda(agenda);

  return new Promise(resolve => {
    agenda.define('someJob', jobProcessor);
    agenda.define('send email', jobProcessor);
    agenda.define('some job', jobProcessor);
    agenda.define('do work', jobProcessor);
    agenda.define('eventsTest', (job, done) => done());
    agenda.define('jobQueueTest', (job, done) => done());
    agenda.define('failBoat', () => {
      throw new Error('Zomg fail');
    });

    // @NOTE: Anything that needs to be access via t.context
    //        should be added here and only here.
    Object.assign(t.context, {
      job,
      agenda,
      mongo,
      mongoHost,
      mongoPort,
      mongoCfg,
      databaseName,
      jobProcessor,
      jobTimeout
    });

    resolve();
  });
};

const afterEach = async (t, closeMongo = true) => {
  const {agenda, mongo} = t.context;

  await stopAgenda(agenda);

  return new Promise(resolve => {
    mongo.dropDatabase(() => {
      if (closeMongo) {
        return resolve(Promise.all([mongo.close(), agenda._mdb.close()]));
      }
      return resolve();
    });
  });
};

export {
  startAgenda,
  stopAgenda,
  clearJobs,
  beforeEach,
  afterEach
};
