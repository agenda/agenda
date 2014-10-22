/** Conf */

/** Attrs */
var attrs = {
    type : {
        once: 'once',
        single: 'single',
        normal: 'normal'
      } 
};

/** Conf defaults */
var conf = {
    default : {
        lockTime: 10 * 60 * 1000,
        concurrency: 5,
        maxConcurrency: 20,
        processEvery: '5 seconds',
        dbName: 'agendaJobs'
      } 
};

/** Messages */
var msg = {
    fail : {
        invalidRepeat: 'failed to calculate nextRunAt due to invalid repeat interval',
        invalidFormat: 'failed to calculate repeatAt time due to invalid format',
        undefinedJob: 'Undefined job'
      } 
};


/** Export variables so they are available */
exports.attrs = attrs;
exports.conf = conf;
exports.msg = msg;