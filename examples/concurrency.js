/**
 * @file Illustrate concurrency and locking
 */
import Agenda from 'agenda';

function time() {
  return new Date().toTimeString().split(' ')[0];
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const agenda = new Agenda({
  db: {
    address: 'mongodb://agendan:nuam0agenda@ds052408.mlab.com:52408/agenda',
    options: { useNewUrlParser: true },
    collection: `agendaJobs-${Math.random()}`,  // start fresh every time
  },
});

let jobRuncount = 1;
agenda.define('long-running job', {
  lockLifetime: 5 * 1000,  // max amount of time the job should take
  concurrency: 3,  // max number of job instances to run at the same time
}, async (job, done) => {
  const thisJob = jobRuncount++;
  console.log(`#${thisJob} started`);
  await sleep(30 * 1000);  // 3 jobs will run at a time
  // await sleep(3 * 1000);  // only one job will run at a time
  console.log(`#${thisJob} finished`);
  done();
});


(async function() {
  console.log(time(), 'Agenda started');
  agenda.processEvery('1 second');
  await agenda.start();
  await agenda.every('1 second', 'long-running job');

  // Log job start and completion/failure
  agenda.on('start', job => {
    console.log(time(), `Job <${job.attrs.name}> starting`);
  });
  agenda.on('success', job => {
    console.log(time(), `Job <${job.attrs.name}> succeeded`);
  });
  agenda.on('fail', (error, job) => {
    console.log(time(), `Job <${job.attrs.name}> failed:`, error);
  });

})();
