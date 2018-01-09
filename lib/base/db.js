/**
 * Created by yneos on 2017/3/21.
 * see http://www.nodeclass.com/api/mongoose.html
 * see http://mongoosejs.com/docs/guide.html
 * see http://mongoosejs.com/docs/api.html
 */

const util = require('util'),
  mongoose = require('mongoose')

mongoose.Promise = global.Promise

// http://mongodb.github.io/node-mongodb-native/2.2/api/MongoClient.html
const defaultOptions = {
  loggerLevel: 'error', // error/warn/info/debug
  poolSize: 5,
  autoReconnect: true,
  reconnectTries: 30,
  reconnectInterval: 3000,
  connectTimeoutMS: 3 * 60 * 1000,
  socketTimeoutMS: 3 * 60 * 1000
}
let logger = null
function getConnection (uri, options, debug) {
  let opt = Object.assign({}, {}, defaultOptions)
  let option = Object.assign({}, options, {moduleName: 'DB'})
  logger = require('./../log/logger.js')(option)
  let conn = mongoose.createConnection(uri, opt)
  conn.on('error', function (err) {
    logger.error(err)
  })
  if (debug) {
    mongoose.set('debug', true)
  }

  return conn
}

/* class MongoDbConnector {
 constructor(uri,options,debug) {
 let opt = _.extend({}, defaultOptions, options);
 this.db =  mongoose.createConnection(uri, opt);
 this.db.on('error',function(err){
 console.error(err);
 });
 if(debug){
 mongoose.set('debug', true);
 }
 }
 } */

/**
 *
 * @param uri
 * @param options to pass to the driver.see http://mongodb.github.io/node-mongodb-native/2.2/api/MongoClient.html
 * @returns {Connection} http://mongoosejs.com/docs/api.html#connection_Connection
 */
function createConnection (uri, options, debug) {
  let conn = getConnection(uri, options, debug)
  return conn
}

module.exports = createConnection
