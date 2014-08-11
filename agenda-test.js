var connStr = 'mongodb://localhost/agenda-test';
var Agenda = require('agenda');

var agenda = new Agenda({db: { address: connStr } });

agenda.now('some job');

agenda.jobs({name: 'some job'}, function(err, jobs) {
  var job = jobs[0];
  job.schedule('in 20 minutes');
  job.repeatEvery('20 minutes');
  job.save();
});
