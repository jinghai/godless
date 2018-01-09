/**
 * Created by yneos on 2017/4/20.
 */

const concat = require('concat-stream')
const AsynUtil = require('./AsynUtil.js')
let logger = null
// 将输入流转化为回调
// 输入为json字符串{method:'MethodName',args:[参数s],classOption:{}}
const reverseInputStream = concat(function (text) {
  try {
    let opt = JSON.parse(text)
    let classOption = opt.classOption
    classOption.console = false
    classOption.file = true
    classOption.moduleName = 'SyncProcess'

    logger = require('../log/logger')(classOption)
    invokeMethod(opt)
  } catch (err) {
    if (logger) logger.error('reverseInputStream', err)
    let ret = {
      ok: false,
      error: err
    }
    respond(ret)
  }
})

process.stdin.pipe(reverseInputStream)

const invokeMethod = (opt) => {
  logger.debug('invokeMethod', opt)
  let classOption = opt.classOption
  let asynUtil = new AsynUtil(classOption)
  let method = opt.method
  if (!asynUtil[method] || typeof asynUtil[method] !== 'function') {
    let ret = {
      ok: false,
      error: 'there is no ' + method + ' method'
    }
    if (logger) logger.error('invokeMethod', ret)
    respond(ret)
  } else {
    let args = opt.args
    asynUtil[method]
            .apply(asynUtil, args)
            .then((ret) => {
              ret = ret || {ok: true}// 防止有些方法没有返回值而出错
              respond(ret)
            })
            .catch((err) => {
              if (logger) logger.error('invokeMethod', err)
              let ret = {
                ok: false,
                err: err
              }
              respond(ret)
            })
  }
}

function respond (data) {
  process.stdout.write(JSON.stringify(data), function () {
    setTimeout(() => {
      process.exit(0)
    }, 600)
  })
}

process.on('uncaughtException', (err) => {
  if (logger) logger.error('uncaughtException', err)
  let ret = {
    ok: false,
    error: err
  }
  respond(ret)
})
