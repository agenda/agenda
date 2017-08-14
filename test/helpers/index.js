import uuidv4 from 'uuid/v4';
import {MongoClient} from 'mongodb';
import {Agenda, Job} from '../../lib';

const mongoHost = process.env.MONGODB_HOST || 'localhost';
const mongoPort = process.env.MONGODB_PORT || '27017';
const jobProcessor = () => {};

const beforeEach = async t => {
  const databaseName = uuidv4();
  const mongoCfg = `mongodb://${mongoHost}:${mongoPort}/${databaseName}`;
  const agenda = new Agenda({db: {address: mongoCfg}});
  const job = new Job({agenda});
  const mongo = await MongoClient.connect(mongoCfg);

  return new Promise(resolve => {
    agenda.on('ready', () => {
      agenda.define('someJob', jobProcessor);
      agenda.define('send email', jobProcessor);
      agenda.define('some job', jobProcessor);
      agenda.define('do work', jobProcessor);

      // @NOTE: Anyting that needs to be access via t.context
      //        should be added here and only here.
      Object.assign(t.context, {
        job,
        agenda,
        mongo,
        mongoHost,
        mongoPort,
        mongoCfg,
        databaseName,
        jobProcessor
      });

      resolve();
    });
  });
};

const afterEach = t => {
  const {agenda, mongo} = t.context;

  return new Promise(resolve => {
    agenda.stop(() => {
      mongo.collection('agendaJobs').remove({}, () => {
        mongo.close(() => {
          agenda._mdb.close(resolve);
        });
      });
    });
  });
};

export {
  beforeEach,
  afterEach
};
