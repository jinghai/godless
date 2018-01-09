/**
 * Created by Administrator on 2017/4/17.
 */
const EventEmitter = require('events').EventEmitter
const defaultOptions = {
  level: 'debug', // { error: 0, warn: 1, info: 2, verbose: 3, debug: 4 }
  console: true,
  file: true,
  moduleName: ''
}

class Observable extends EventEmitter {
  constructor (options) {
    super()
    this.options = Object.assign({}, defaultOptions, options)
    this.logger = require('../log/logger.js')(this.options)
  }
}

module.exports = Observable
