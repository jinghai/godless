/**
 * Created by Administrator on 2017/2/6.
 * https://github.com/winstonjs/winston#using-the-default-logger
 * https://github.com/winstonjs/winston/blob/master/docs/transports.md#mongodb-transport
 */
//
const winston = require('winston')
const util = require('./../util/util.js')
const path = require('path')

const fileFullName = process.argv[1]// 当前执行的文件全路径

const defaultConfig = {
    level: 'debug', // { error: 0, warn: 1, info: 2, verbose: 3, debug: 4 }
    console: true,
    file: true,
    fileName: path.basename(fileFullName) + '.log',
    fileDirName: path.dirname(fileFullName),
    moduleName: ''
  },
  levels = {
    'error': true,
    'warn': true,
    'info': true,
    'verbose': true,
    'debug': true
  }

class Logger {
  constructor (option) {
    this.option = Object.assign({}, defaultConfig, option)
    if (!levels[this.option.level.toLowerCase()] === true) {
      this.option.level = defaultConfig.level
    }
    this.initLogger()
  }

  initLogger (option) {
    let transports = [], self = this, moduleName = this.option.moduleName

    function formatter (winstonOptions) {
      return 'pid[' + process.pid + '] ' +
                util.dateFormat(new Date(), 'yyyy-MM-dd hh:mm:ss.S') + ' ' +
                winstonOptions.level.toLowerCase() +
                '\t' +
                moduleName +
                '.' +
                (winstonOptions.message ? winstonOptions.message : '') +
                (winstonOptions.meta && Object.keys(winstonOptions.meta).length ? ' ' + JSON.stringify(winstonOptions.meta) : '')
    }

    if (this.option.console) {
      transports.push(new (winston.transports.Console)({
        json: false,
        prettyPrint: true,
        stringify: true,
        timestamp: true,
        formatter: formatter
      }))
    }
    if (this.option.file) {
      let logFile = path.resolve(self.option.fileDirName, self.option.fileName)
      transports.push(new (winston.transports.File)({
        json: false,
        filename: logFile,
        stringify: true,
        maxsize: 1024 * 1024 * 200, // 200M
        maxFiles: 1,
        timestamp: true,
        formatter: formatter
      }))
    }
    this.logger = new winston.Logger({
      level: self.option.level,
      transports: transports
    })
  }

  log () {
    let self = this, as = [].slice.call(arguments)
    let a1 = as.shift()
    let args = []
    if (typeof a1 === 'string' && levels[a1.toLowerCase()] === true) {
      args.push(a1)
    } else {
      args.push('info')
      as.unshift(a1)
    }
    args = args.concat(as)
    return this.logger.log.apply(this.logger, args)
  }

  error () {
    let args = ['error'].concat([].slice.call(arguments))
    return this.log.apply(this, args)
  }

  warn () {
    let args = ['warn'].concat([].slice.call(arguments))
    return this.log.apply(this, args)
  }

  info () {
    let args = ['info'].concat([].slice.call(arguments))
    return this.log.apply(this, args)
  }

  verbose () {
    let args = ['verbose'].concat([].slice.call(arguments))
    return this.log.apply(this, args)
  }

  debug () {
    let args = ['debug'].concat([].slice.call(arguments))
    return this.log.apply(this, args)
  }

  test (key, level, msg) {
    level = level || 'debug'
    msg = msg || ''
    let innerkey = this.option.moduleName + key
    if (!this.maps) {
      this.maps = {}
    }
    if (!this.maps[innerkey]) {
      let obj = {
        st: Date.now()
      }
      this.maps[innerkey] = obj
    } else {
      let obj = this.maps[innerkey]
      obj.et = Date.now()
      this.log(level, key, util.dateDiff(obj.et - obj.st), msg)
      delete this.maps[innerkey]
    }
  }
}

module.exports = function (optionOrLevel, moduleName) {
  let option = {}
  let a1 = arguments[0]
  let a2 = arguments[1]
  if (typeof a1 === 'string') {
    option.level = a1
  } else {
    option = optionOrLevel
  }
  if (typeof a2 === 'string') {
    option.moduleName = a2
  }

  return new Logger(option)
}

/*
 var l = module.exports({file:false}, 'logger');
 l.test("test");
 l.log("1", 2, true, {a: 'a', b: "b", is: false})
 l.debug("1", 2, true, {a: 'a', b: "b", is: false})
 l.info("1", 2, true, {a: 'a', b: "b", is: false})
 l.warn("1", 2, true, {a: 'a', b: "b", is: false})
 l.error("1", 2, true, {a: 'a', b: "b", is: false})
 l.test("test"); */
