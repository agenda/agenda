module.exports = {
  "none" : function(agenda) {},
  "daily" : function(agenda) {
    agenda.define('once a day test job', function(job, done) {
      process.send('ran');
      done();
      process.exit(0);
    });

    agenda.every('one day', 'once a day test job');
  },
  "daily-array" : function(agenda) {
    agenda.define('daily test 1', function(job, done) {
      process.send('test1-ran');
      done();
    });

    agenda.define('daily test 2', function(job, done) {
      process.send('test2-ran');
      done();
    });


    agenda.every('one day', [ 'daily test 1', 'daily test 2' ]);
  },
  "define-future-job" : function(agenda) {
    var future = new Date();
    future.setDate( future.getDate() + 1);

    agenda.define('job in the future', function(job, done) {
      process.send('ran');
      done();
      process.exit(0);
    });

    agenda.schedule(future, 'job in the future');
  },
  "define-past-due-job" : function(agenda) {
    var past = new Date();
    past.setDate( past.getDate() - 1);

    agenda.define('job in the past', function(job, done) {
      process.send('ran');
      done();
      process.exit(0);
    });

    agenda.schedule(past, 'job in the past');
  },
  "schedule-array" : function(agenda) {
    var past = new Date();
    past.setDate( past.getDate() - 1);

    agenda.define('scheduled test 1', function(job, done) {
      process.send('test1-ran');
      done();
    });

    agenda.define('scheduled test 2', function(job, done) {
      process.send('test2-ran');
      done();
    });

    agenda.schedule(past, [ 'scheduled test 1', 'scheduled test 2' ]);
  },
  "now" : function(agenda) {
    agenda.define('now run this job', function(job, done) {
      process.send('ran');
      done();
      process.exit(0);
    });

    agenda.now('now run this job');
  }
};