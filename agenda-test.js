var connStr = 'mongodb://localhost/agenda-test';
var Agenda = require('agenda');

var agenda = new Agenda({db: { address: connStr } });

agenda.define('5 minutes job', function(job, done) {
  console.log("Running 5 minutes job");
  done();
});

agenda.define('10 minutes job', function(job, done) {
  console.log("Running 10 minutes job");
  done();
});

agenda.define('once a day job', function(job, done) {
  console.log('ONCE A DAY RUNNING');
  done();
});

agenda.every('5 minutes', '5 minutes job');
agenda.every('10 minutes', '10 minutes job');
agenda.every('0 5 * * 1-5', 'once a day job');

agenda.start();
