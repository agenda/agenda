var log4js = require('log4js');
var logger = log4js.getLogger('agenda');


var getUrl = function(username, password, hosts, ports, database){
  var url = null;
  if(!!username && !!password && !! hosts && !!ports && !! database){
    url = "postgres://" + username +":"+password+"@"+hosts+":"+ports+"/"+database ;
    logger.debug("PostgreSQL database url:", url);
  } else {
    logger.debug("Required parameters not set username, password, hosts, ports, database", username,password,hosts,ports,database);
  }
  return url;
};

var executeSql = function(client, sqlStatement, callback) {
  client.query(sqlStatement, function(err, results){

    if (err) {
      logger.debug("failed to execute the SQL statement: " + sqlStatement  + " because: " + err);
        callback(err, null);
    }
    else {
      logger.debug("successfully executed the SQL statement: " , sqlStatement);
      if(results.rows.length){
        if(typeof results.rows[0].next_run_at === 'string'){
          results.rows[0].next_run_at = new Date(results.rows[0].next_run_at);
        }
        if(typeof results.rows[0].last_run_at === 'string'){
          results.rows[0].last_run_at = new Date(results.rows[0].last_run_at);
        }
        if(typeof results.rows[0].failed_at === 'string'){
          results.rows[0].failed_at = new Date(results.rows[0].failed_at);

        }
        if(typeof results.rows[0].last_finished_at === 'string'){
          results.rows[0].last_finished_at = new Date(results.rows[0].last_finished_at);
        }
        if(typeof results.rows[0].locked_at === 'string'){
          results.rows[0].locked_at = new Date(results.rows[0].locked_at);
        }

      }
      callback(null, results.rows);

    }
  });
};

var getKeys = function (jsonArray){
  var arrayLength = jsonArray.length;
  var index = 0;
  var keyArray = [];
  for(i in jsonArray){
    var key = i;
    var val = jsonArray[i];
    for(j in val){
        var final_key = j;
        keyArray[index] = final_key;
        index++;
    }
    return keyArray;
  }
}

/*
Find details and if found , modify and return the updated job
*/
var findAndModify = function(client, tableName, selectColumns, updateValues, condition, sort, joinCondition, isnew, callback){
  logger.debug("condition in findAndModify :" , condition);
  var key = getKeys(condition);
  var sqlQuery = getSelectQuery(tableName, selectColumns, condition, sort, joinCondition);
  executeSql(client, sqlQuery, function(err, preResult){
    if(err){
      logger.debug("query not run :", err);
      callback(err, null);
    }
    else{
      if(preResult.length){
        sqlQuery = getUpdateQuery(tableName, updateValues, condition, joinCondition);
        executeSql(client, sqlQuery, function(err, result){
          if(err){
            logger.debug("query not run :", err);
            callback(err, null);
          }
          else{
            logger.debug("Job updated" );
            sqlQuery = getSelectQuery(tableName, selectColumns, false, sort, joinCondition);
            executeSql(client, "SELECT * FROM " + tableName + " WHERE "+ key[0] + " = '" + condition[0][key[0]] + "'", function(err, postResult){
              logger.debug("updated job is : " , postResult);
              if(isnew){
                callback(null, postResult);
              }
              else{
                callback(null, preResult);
              }
            });
          }
        });
      }
      else{
        callback(null,null);
      }
    }
  });
}


/*
Checks if the job is present in the table.If present , then updates the job, else creates a new entry
joinCondition is "AND" or "OR" to for joining the condition
*/
var upsert = function (client, tableName, updateValues, condition, sort, joinCondition, isnew, onInsertUpdate, callback){
  var key = getKeys(condition);
  var sqlQuery = getSelectQuery(tableName, false, condition, sort, joinCondition);
  executeSql(client, sqlQuery, function(err, preResult){
    if(err){
      logger.error("query not run : ", err);
      callback(err, null);
    }
    else{
      if(preResult.length){
        sqlQuery = getUpdateQuery(tableName, updateValues, condition, joinCondition);
        executeSql(client, sqlQuery, function(err, postResult){
          if(err){
            logger.error("query not run : ", err);
            callback(err, null);
          }
          else{
            logger.info("Job updated in upsert");
            executeSql(client, "SELECT * FROM " + tableName + " WHERE "+ key[0] + " = '" + condition[0][key[0]] + "'", function(err, postResult){
              logger.debug("updated job is : " , postResult);
              if(isnew){
                callback(null, postResult);
              }
              else{
                callback(null, preResult);
              }
            });
          }
        });
      }
      else{
        logger.debug("Job not present , will be inserted");
        sqlQuery = getInsertQuery(tableName, condition);
        executeSql(client, sqlQuery, function(err, insertResult){
          if(err){
            logger.error("cannot insert job because : " , err);
            callback(err, null);
          }
          else{
            logger.info("Job insertion started");
            if(onInsertUpdate){
              logger.debug("onInsertUpdate is : ", onInsertUpdate);
              sqlQuery = getUpdateQuery(tableName, onInsertUpdate, condition, joinCondition);
            }
            else{
              sqlQuery = getUpdateQuery(tableName, updateValues, condition, joinCondition);
            }
            executeSql(client, sqlQuery, function(err, postResult){
              if(err){
                logger.error("query not run : ", err);
                callback(err, null);
              }
              else{
                logger.info("Job inserted");
                executeSql(client, "SELECT * FROM " + tableName + " WHERE "+ key[0] + " = '" + condition[0][key[0]] + "'", function(err, result){
                logger.debug("updated job is : " , result);
                callback(null, result);
              });
            }
          });
         }
       });
      }
    }
  });
};


/*
generates the insert query. values is a JSON array
values is a JSOn array with values to insert in a row
Example for values : [{id: 1}, {name: 'jobName'}, ...]
*/
var getInsertQuery = function (tableName, values){
  var sqlQuery = "INSERT INTO " + tableName + " (";
  var keys = getKeys(values);
  for(var i = 0 ; i < keys.length ; ++i){
    sqlQuery = sqlQuery + keys[i]  ;
    if(i < (keys.length - 1)){
      sqlQuery = sqlQuery + ", ";
    }
  }
  sqlQuery = sqlQuery + ") " + "VALUES (";

  for(var i = 0 ; i <keys.length ; ++i){
    if(typeof values[0][keys[i]] == 'object'){
      var x = values[0][keys[i]];
      if(keys[i] == 'data'){

        sqlQuery = sqlQuery  + "\'" + JSON.stringify(x) + "\'";
      }
      else if (x instanceof Date) {
        var date = new Date(x);
        sqlQuery = sqlQuery  + "\'" + date.toUTCString() + "\'";

      }
      else{
      var value = '';
      for(var key in x) {
        var value = x[key];
        //logger.debug(value , key);
      }
      var operator = getOperator(key);
      if(value instanceof Date){
        var date = new Date(value);
        //logger.debug("is date " , value);
        sqlQuery = sqlQuery  + "\'" + date.toUTCString() + "\'";
      }
      if(values[0][keys[i]] == null){
        sqlQuery = sqlQuery + "= NULL";
      }
      else{
        sqlQuery = sqlQuery  + "\'" + value + "\'";
      }
    }
    }
    else{
      if(values[0][keys[i]] == null){
        sqlQuery = sqlQuery + " = NULL";
      }
      else{
        sqlQuery = sqlQuery +  "\'" + values[0][keys[i]]  + "\'";
      }
    }
    if(i < (keys.length - 1)){
        sqlQuery = sqlQuery + " , " ;
    }
  }
  sqlQuery = sqlQuery + ") ";
  logger.debug("Insert Query is : ", sqlQuery);
  return sqlQuery;
}

/*
generates the update Query.
updateValues is a JSON array with the column to be updated as a json object,
condition is a JSOn array with condition to select the row
Example for updateValues and condition : [{id: 1}, {name: 'jobName'}, ...]
*/
var getUpdateQuery = function (tableName, updateValues, condition, joinCondition){
  if(updateValues){
  //logger.debug("update values are : ", updateValues);
  sqlQuery = "UPDATE " + tableName + " SET " ;
  sqlQuery = processQuery("update", sqlQuery, updateValues, " , ");
  sqlQuery = sqlQuery + " WHERE " ;
  sqlQuery = processQuery("select", sqlQuery, condition, joinCondition);
  logger.debug("Update Query is : ", sqlQuery);
  return sqlQuery;
}
}
/*
generates the select Query.
condition is a JSOn array with condition to select the row
Example for condition : [{id: 1}, {name: 'jobName'}, ...]
*/
var getSelectQuery = function(tableName, selectColumns, condition, sort, joinCondition){
  var sqlQuery = "SELECT " ;

  if(selectColumns){
    for(var i = 0 ; i < selectColumns.length ; ++i){
      sqlQuery = sqlQuery + selectColumns[i] + " ";
    }
    sqlQuery = sqlQuery + "FROM " + tableName;
  }
  else{
    sqlQuery = sqlQuery + " * FROM " + tableName ;
  }
  logger.debug("condition is :", condition);
  if(condition){
    if(condition != '{}'){
      var keys = getKeys(condition);
      if(keys.length){
        sqlQuery = sqlQuery + " WHERE ";
      }

      sqlQuery = processQuery("select", sqlQuery, condition, joinCondition);
    }
  }
  if(sort){
    var keys = getKeys(sort);
    sqlQuery = sqlQuery + " ORDER BY " + keys[0] ;
    if(sort[0][keys[0]] == -1){
      sqlQuery = sqlQuery + " DESC LIMIT 1";
    }
    else{
      sqlQuery = sqlQuery + " ASC LIMIT 1";
    }
  }
  logger.debug("Select Query is : ", sqlQuery);
  return sqlQuery;
}

var getDeleteQuery = function(tableName, condition, conditionArray, joinCondition){
  var sqlQuery = "DELETE FROM " + tableName ;
  if(condition){
    if(condition != '{}'){
      var keys = getKeys(condition);
      sqlQuery = sqlQuery + " WHERE ";
      sqlQuery = processQuery("select", sqlQuery, condition, joinCondition);
    }
  }
  return sqlQuery;
};

var getOperator = function(key){
  if(key == '$ne'){
    return " <> ";
  }
  else if(key == '$lte'){
    return " <= ";
  }
  else if(key == '$in'){
    return " IN ";
  }
  else if(key == '$ni'){
    return " NOT IN ";
  }

}

var processQuery = function(type , sqlQuery, condition, joinCondition){
  var keys = getKeys(condition);
  for(var i = 0 ; i < keys.length ; ++i){

      if(typeof condition[0][keys[i]] == 'object'){
       var value = condition[0][keys[i]];
       if(keys[i] === 'data'){
          sqlQuery = sqlQuery + keys[i] + " = \'" + JSON.stringify(value) + "\'";
         if(i < (keys.length - 1)){
           sqlQuery = sqlQuery + " " + joinCondition + " ";
         }
       }
       else if (value == null){
         if(type == "select") {
         sqlQuery = sqlQuery + keys[i] + " is null ";
       }
       else{
         sqlQuery = sqlQuery + keys[i] + " = null ";
       }
        if(i < (keys.length - 1)){
          sqlQuery = sqlQuery + " " + joinCondition + " ";
        }
       }
       else if(value instanceof Date){
         var date = new Date(value);
         sqlQuery = sqlQuery + keys[i] + " = \'" + date.toUTCString() + "\'";
         if(i < (keys.length - 1)){
           sqlQuery = sqlQuery + " " + joinCondition + " ";
         }
      }
      else{
         for(var key in value) {
           var val = value[key];
           var operator = getOperator(key);
           if(val instanceof Date){
             var date = new Date(val);
             sqlQuery = sqlQuery + keys[i] + operator + "'" + date.toUTCString() + "'";
           }
           else{
             sqlQuery = sqlQuery + keys[i] + operator + "'" + val + "'";
           }
           if(i < (keys.length - 1)){
             sqlQuery = sqlQuery + " " + joinCondition + " ";
           }
         }
      }
    }
    else{

      sqlQuery = sqlQuery + keys[i] + " = \'" + condition[0][keys[i]] + "\'";
      if(i < (keys.length - 1)){
        sqlQuery = sqlQuery + " " + joinCondition + " ";
      }
    }
  }
  return sqlQuery;
}

module.exports.getUrl = getUrl;
module.exports.upsert = upsert;
module.exports.getKeys = getKeys;
module.exports.executeSql = executeSql;
module.exports.getSelectQuery = getSelectQuery;
module.exports.getInsertQuery = getInsertQuery;
module.exports.getUpdateQuery = getUpdateQuery;
module.exports.getDeleteQuery = getDeleteQuery;
module.exports.processQuery = processQuery;
module.exports.findAndModify = findAndModify;
