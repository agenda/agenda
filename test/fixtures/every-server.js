var connStr = process.argv[2];
var Agenda = require('../../index.js');

var agenda = new Agenda({db: { address: connStr } });

agenda.define('once a day test job', function(job, done) {
  process.send('ran');
  done();
  process.exit(0);
});

setTimeout(function() {
  process.send('notRan');
  process.exit(0);
}, 500);

agenda.every('0 5 * * 1-5', 'once a day test job');
agenda.start();

