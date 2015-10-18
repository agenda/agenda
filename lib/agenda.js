var Job = require('./job.js');
var humanInterval = require('human-interval');
var utils = require('util');
var Emitter = require('events').EventEmitter;
var mongo = require('mongoskin');
var pg = require('pg');
var log4js = require('log4js');
var logger = log4js.getLogger('agenda');
log4js.configure(__dirname + '/../etc/log4js.json', { cwd: __dirname + '/../log' } );
var db = require('./dbInteraction.js');
/*********************************
**********************************
      Initializing Agenda
**********************************
*********************************/


var Agenda = module.exports = function(config) {
  if (!(this instanceof Agenda)) {
    return new Agenda(config);
  }
  config = config ? config : {};
  this._name = config.name;
  this._processEvery = humanInterval(config.processEvery) || humanInterval('5 seconds');
  this._defaultConcurrency = config.defaultConcurrency || 5;
  this._maxConcurrency = config.maxConcurrency || 20;
  this._definitions = {};
  this._runningJobs = [];
  this._jobQueue = [];
  this._defaultLockLifetime = config.defaultLockLifetime ||  30 * 1000; //10 minute default lockLifetime
  this.client = this.database(config.address, config.dbOptions);
  this.tableName = config.collection;
};

utils.inherits(Agenda, Emitter);

/*********************************
**********************************
  Agenda Configuration Methods
**********************************
*********************************/

Agenda.prototype.database = function(connectionOptions, dbOptions){
  try{
    // logger.info("Connecting to PostgreSQL with connection options:", connectionOptions);
    var username=connectionOptions.username;
    var password=connectionOptions.password;
    var hosts= connectionOptions.hosts;
    var ports= connectionOptions.ports;
    var database=connectionOptions.database;
    var url = db.getUrl(username, password, hosts, ports, database);
    if(url) {
      client = new pg.Client(url);
      client.connect();
      logger.debug("client connection successful");
      return client;
    }
  }
  catch(e){
     logger.info('Unhandeld exception in postgres connector method (getDatabase)', e);
  }
};

// Close the postgres connection
Agenda.prototype.end = function(){
  client.end();
};

Agenda.prototype.name = function(name) {
  this._name = name;
  return this;
};

Agenda.prototype.processEvery = function(time) {
  this._processEvery = humanInterval(time);
  return this;
};

Agenda.prototype.maxConcurrency = function(num) {
  this._maxConcurrency = num;
  return this;
};

Agenda.prototype.defaultConcurrency = function(num) {
  this._defaultConcurrency = num;
  return this;
};

Agenda.prototype.defaultLockLifetime = function(ms){
  this._defaultLockLifetime = ms;
  return this;
};



 /*********************************
 **********************************
     Defining  Job Processing
 **********************************
 *********************************/


 //Defining Job processing behavior
 Agenda.prototype.define = function(name, options, processor) {
   logger.debug("Job defined with name : ", name , " and options : ", options );
   if (!processor) {
     processor = options;
     options = {};
   }
   this._definitions[name] = {
     fn: processor,
     concurrency: options.concurrency || this._defaultConcurrency,
     priority: options.priority || 0,
     lockLifetime: options.lockLifetime || this._defaultLockLifetime,
     running: 0
   };
 };

 /*********************************
 **********************************
     Create Job Methods
 **********************************
 *********************************/



 //creates a job with type = single
 Agenda.prototype.every = function(interval, names, data) {
   var self = this;
   if (typeof names === 'string' || names instanceof String) {
     return createJob(interval, names, data);
   } else if (Array.isArray(names)) {
     return createJobs(interval, names, data);
   }

   function createJob(interval, name, data) {
     var job = self.create(name, data);
     job.attrs.type = 'single';
     job.repeatEvery(interval);
     logger.debug("repeat_interval : ", job.attrs.repeat_interval);
     job.computenext_run_at();
     job.save();
     return job;
   }

   function createJobs(interval, names, data) {
     return names.map(function (name) {
       return createJob(interval, name, data);
     });
   }
 };

 //Create a job which is scheduled to run at "when"
 Agenda.prototype.schedule = function(when, names, data) {
   var self = this;

   if (typeof names === 'string' || names instanceof String) {
     return createJob(when, names, data);
   } else if (Array.isArray(names)) {
     return createJobs(when, names, data);
   }

   function createJob(when, name, data) {
     var job = self.create(name, data);
     job.schedule(when);
     job.save();
     return job;
   }

   function createJobs(when, names, data) {
     return names.map(function (name) {
       return createJob(when, name, data);
     });
   }
 };

 //creates a job which is run immediately
 Agenda.prototype.now = function(name, data) {
   var job = this.create(name, data);
   job.schedule(new Date());
   job.save();
   return job;
 };


 //Once the job is defined, it can be created
 Agenda.prototype.create = function(name, data) {
   logger.debug("Came inside create for job name : ", name , " with agenda : ", this);
   var priority = this._definitions[name] ? this._definitions[name].priority : 0;
   var job = new Job({name: name, data: data, type: 'normal', priority: priority, agenda: this});
   return job;
 };



 //Once created, job will be saved in the db
 Agenda.prototype.saveJob = function(job, cb) {
   logger.debug("came in saveJob for job :" , job);
   var fn = cb,
       self = this;

   var props = job.toJSON();
   if(props.data == null){
     props.data = {}
   }
   var id = job.attrs.id;
   var unique = job.attrs.unique;

   delete props.id;
   delete props.unique;

   props.last_modified_by = this._name;

   var now = new Date(),
       protect = {},
       update = [props],
       setOnInsert = [];
       logger.debug("update is : " , update);
  if (id) {
    db.findAndModify(self.client, self.tableName, false, update, [{id: id}], false, "joinCondition",true, processDbResult);
  } else if (props.type == 'single') {
  if (props.next_run_at && props.next_run_at <= now) {
    protect.next_run_at = props.next_run_at;
    delete props.next_run_at;
  }
  if (Object.keys(protect).length > 0) {
    setOnInsert = [protect];
  }
  if(!setOnInsert.length){
    setOnInsert = update;
  }
  // Try an upsert.
  db.upsert(self.client, self.tableName, update, [{name: props.name, type: 'single'}], false, "AND",  true, setOnInsert, processDbResult);
} else if (unique) {
  var query = job.attrs.unique;
  query.name = props.name;
  db.upsert(self.client, self.tableName, update, [query], false, "AND", true, false, processDbResult);
} else {
  db.upsert(self.client, self.tableName, update, [{name: props.name}], false, "AND",true, false, processDbResult);
}

   function processDbResult(err, res) {
     if (err) {
       throw(err);
     } else if (res) {
       if (Array.isArray(res)) {
         res = res[0];
       }

       job.attrs.id = res.id;
       job.attrs.next_run_at = res.next_run_at;
       if (job.attrs.next_run_at && job.attrs.next_run_at < self._next_scan_at) {
         processJobs.call(self, job);
       }
     }

     if (fn) {
       fn(err, job);
     }
   }
 };



/*********************************
**********************************
    Manage Job Methods
**********************************
*********************************/

Agenda.prototype.cancel = function(query, callback) {
  var sqlQuery = db.getDeleteQuery(this.tableName, query, 'AND');
  db.executeSql(this.client , sqlQuery, function(err , result){
   if(err){
     logger.error("Query execution failed : " , err);
     callback(err);
   }
   logger.info("Job cancelled");
   callback(null, result);
  });
};

Agenda.prototype.purge = function(cb) {
  var definedNames = Object.keys(this._definitions);
  var sqlQuery = "DELETE FROM " + this.tableName + " WHERE name NOT IN (" ;
  for(var i = 0 ; i < definedNames.length ; ++i){
    sqlQuery = sqlQuery + definedNames[i] ;
    if(i < definedNames.length - 1){
      sqlQuery = sqlQuery + ", ";
    }
  }
  sqlQuery = sqlQuery + ")";
  db.executeSql(this.client, sqlQuery , function(err, result){
    if(err){
      logger.error("Query execution failed : " , err);
      callback(err, null);
    }
    logger.info("Jobs Purged");
    callback();
  });
};

Agenda.prototype.jobs = function(clause, callback) {
  var args = Array.prototype.slice.call(arguments);
  logger.debug("came inside prototype.jobs");
  if (typeof args[args.length - 1] === 'function') {
    args.push(findJobsResultWrapper(this, args.pop()));
  }
  var sqlQuery = db.getSelectQuery(this.tableName, false, [args[0]], false, "AND");
  db.executeSql(this.client, sqlQuery, function(err, result){
    if(err){
      logger.error("Query execution failed : " , err);
      callback(err, null);
    }
    logger.info("Jobs Found");
    callback(null, result);
  });
};

 /*********************************
 **********************************
       Job Flow Methods
 **********************************
 *********************************/

 Agenda.prototype.start = function() {
   logger.debug("Agenda started");
   if (!this._processInterval) {
     this._processInterval = setInterval(processJobs.bind(this), this._processEvery);
     process.nextTick(processJobs.bind(this));
   }
 };

 function processJobs(extraJob) {
   if (!this._processInterval) {
     return;
   }

   var definitions = this._definitions,
     jobName,
     jobQueue = this._jobQueue,
     self = this;
   if (!extraJob) {
     for (jobName in definitions) {
       jobQueueFilling(jobName);
     }
   } else {
     // On the fly lock a job
     var now = new Date();
     db.findAndModify(self.client, self.tableName, false, [{locked_at: now.toUTCString()}], [{ id: extraJob.attrs.id, locked_at: null }], false, "AND", false, function(err, resp){
       if (resp) {
         jobQueue.unshift(extraJob);
         jobProcessing();
       }
     });
   }

   function jobQueueFilling(name) {
     var now = new Date() ;
     self._next_scan_at = new Date(now.valueOf() + self._processEvery)
     self._findAndLockNextJob(name, definitions[name], function (err, job) {
       if (err) {
         throw err;
       }

       if (job) {
         if( Array.isArray(job) ) {
           jobQueue = job.concat(jobQueue);
         } else {
           jobQueue.unshift(job);
         }

         jobQueueFilling(name);
         jobProcessing();
       }
     });
   }

   function jobProcessing() {
     if (!jobQueue.length) {
       return;
     }
     var now = new Date();
     var job = jobQueue.pop();
     var name = job.attrs.name;
     var jobDefinition = definitions[name];
     if (job.attrs.next_run_at < now) {
       runOrRetry();
     } else {
       setTimeout(runOrRetry, job.attrs.next_run_at - now);
     }

     function runOrRetry() {
       if (self._processInterval) {
         if (jobDefinition.concurrency > jobDefinition.running &&
             self._runningJobs.length < self._maxConcurrency) {

           self._runningJobs.push(job);
           jobDefinition.running++;

           job.run(processJobResult);
           jobProcessing();
         } else {
           // Put on top to run ASAP
           jobQueue.push(job);
         }
       }
     }
   }

   function processJobResult(err, job) {
     var name = job.attrs.name;

     self._runningJobs.splice(self._runningJobs.indexOf(job), 1);
     definitions[name].running--;

     jobProcessing();
   }
 }

 /**
  * Find and lock jobs
  * @param {String} jobName
  * @param {Function} cb
  * @protected
  */
 Agenda.prototype._findAndLockNextJob = function(jobName, definition, callback) {
   var self = this;
   var now = new Date() ;
   var lockDeadline = new Date(Date.now().valueOf() - definition.lockLifetime) ;

   var sqlQuery = "SELECT * FROM " + self.tableName + " WHERE name = '" + jobName + "' AND (locked_at is null OR locked_at <= '" + lockDeadline.toUTCString()   + "') AND next_run_at <= '" + self._next_scan_at.toUTCString()  + "' ORDER BY priority DESC LIMIT 1";
   db.executeSql(self.client, sqlQuery, function(err, result){
     if(err){
       logger.error("cannot executeSql : " , err);
       var jobResultWrapper = findJobsResultWrapper(self, callback);
       jobResultWrapper(err, null);
     }
     else{
       logger.debug("result is :" , result);
       if(result.length){
         var updateQuery = "UPDATE " + self.tableName + " SET locked_at = '" + now.toUTCString()  + "' WHERE name = '" + jobName +"'";
         db.executeSql(self.client, updateQuery, function(err, result){
           if(err){
             logger.error("cannot executeSql : " , err);
             var jobResultWrapper = findJobsResultWrapper(self, callback);
             jobResultWrapper(err, null);
           }
           else{
             db.executeSql(self.client, "SELECT * FROM " + self.tableName + " WHERE name = '" + jobName + "'", findJobsResultWrapper(self, callback));
           }
         });
       }
       else{
           var jobResultWrapper = findJobsResultWrapper(self, callback);
             jobResultWrapper(null, null);
      }
    }
  });
};

 /**
  *
  * @param agenda
  * @param cb
  * @return {Function}
  * @private
  */
 function findJobsResultWrapper(agenda, cb) {
   return function (err, jobs) {
     if (jobs) {
       //query result can be array or one record
       if (Array.isArray(jobs)) {
         jobs = jobs.map(createJob.bind(null, agenda));
       } else {
         jobs = createJob(agenda, jobs);
       }
     }
     cb(err, jobs);
   };
 }


 Agenda.prototype.stop = function(cb) {
   cb = cb || function() {};
   clearInterval(this._processInterval);
   this._processInterval = undefined;
   unlockJobs.call(this, cb);
 };


 /**
  * Create Job object from data
  * @param {Object} agenda
  * @param {Object} jobData
  * @return {Job}
  * @private
  */
 function createJob(agenda, jobData) {
   jobData.agenda = agenda;
   return new Job(jobData);
 }

 function unlockJobs(done) {
   function getJobId(j) {
     return j.attrs.id;
   }

   var jobIds = this._jobQueue.map(getJobId).concat(this._runningJobs.map(getJobId));
   var sqlQuery = db.getUpdateQuery(this.tableName, [{locked_at: null}], [{id: { $in: jobIds } }], "AND");
   db.executeSql(this.client, sqlQuery, function(err, result){
     if(err){
       logger.error("query not run : ", err);
       callback(err, null);
     }
     else{
       callback();
     }
   });
 }
