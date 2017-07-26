/* globals before, describe, it, beforeEach, after, afterEach */
const expect = require('expect.js');
const path = require('path');
const moment = require('moment-timezone');
const cp = require('child_process');
const Agenda = require('../index');
const Job = require('../lib/job');
const MongoClient = require('mongodb').MongoClient;

const mongoHost = process.env.MONGODB_HOST || 'localhost';
const mongoPort = process.env.MONGODB_PORT || '27017';
const mongoCfg = 'mongodb://' + mongoHost + ':' + mongoPort + '/agenda-test';

// create agenda instances
var jobs = null;
var mongo = null;

function clearJobs(done) {
  mongo.collection('agendaJobs').remove({}, done);
}

// Slow timeouts for Travis
const jobTimeout = process.env.TRAVIS ? 3500 : 500;
const jobType = 'do work';
const jobProcessor  = function(job) {};

function failOnError(err) {
  if (err) {
    throw err;
  }
}

describe('agenda', function() {
  beforeEach(function(done) {
    jobs = new Agenda({
      db: {
        address: mongoCfg
      }
    }, function(err) {
      MongoClient.connect(mongoCfg, function( error, db ){
        mongo = db;
        setTimeout(function() {
          clearJobs(function() {
            jobs.define('someJob', jobProcessor);
            jobs.define('send email', jobProcessor);
            jobs.define('some job', jobProcessor);
            jobs.define(jobType, jobProcessor);
            done();
          });
        }, 50);
      });
    });
  });

  afterEach(function(done) {
    setTimeout(function() {
      jobs.stop(function() {
        clearJobs(function() {
          mongo.close(function() {
            jobs._mdb.close(done);
          });
        });
      });
    }, 50);
  });

  describe('Retry', function () {
    it('should retry a job', function(done) {
      var shouldFail = true;
      jobs.define('a job', function (job, done) {
        if(shouldFail) {
          shouldFail = false;
          return done(new Error('test failure'));
        }
        done();
      });

      jobs.on('fail:a job', function (err, job) {
        job
          .schedule('now')
          .save();
      });

      jobs.on('success:a job', function () {
        done();
      });

      jobs.now('a job');

      jobs.start();
    });
  });

});