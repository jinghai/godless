/**
 * Created by yneos on 2017/4/17.
 * 面向用户提供的Util，Util中所有方法均为同步方法，以方便用户使用
 */
const spawnSync = require('child_process').spawnSync
const path = require('path')
const SyncProcessPath = path.resolve(__dirname, './SyncProcess.js')
const Observable = require('../base/observable.js')
const util = require('../util/util.js')

class SyncUtil extends Observable {
  constructor (options) {
    options = options || {}
    options.moduleName = 'SyncUtil'
    super(options)
  }

  _invoke (param) {
    this.logger.debug('_invoke(param)', param)
    param.classOption = this.options
        // schema中含有type:String等无法序列化的属性，会造成Persist出错
    param.classOption.schema = {}
    let req = JSON.stringify(param)
    let res = spawnSync('node', [SyncProcessPath], {input: req, encoding: 'utf-8'})
    if (res.status !== 0) {
      let err = res.stderr.toString()
      this.logger.error(err)
      return {ok: false, error: err}
    }
    if (res.error) {
      if (typeof res.error === 'string') res.error = new Error(res.error)
      this.logger.error(res.error)
      return {ok: false, error: res.error}
    }
    let str = res.stdout
    str = str.split('\n')
    str = str[str.length - 1]
    let response = JSON.parse(str)
    return response
  }

  request (option) {
    this.logger.debug('request(option)', option)
    this.logger.test('request(option)', 'verbose')
    let result = this._invoke({
      method: 'request',
      args: [].slice.call(arguments)
    })
    if (result.ok) {
      result.$ = util.get$(result.url, result.html)
    }
    this.logger.test('request(option)', 'verbose', result.ok ? 'ok' : 'no')
    return result
  }

  get (option, data) {
    this.logger.debug('get(option, data)', option, data)
    this.logger.test('get(option, data)', 'verbose')
    let result = this._invoke({
      method: 'get',
      args: [].slice.call(arguments)
    })
    if (result.ok) {
      result.$ = util.get$(result.url, result.html)
    }
    this.logger.test('get(option, data)', 'verbose', result.ok)
    return result
  }

  post (option, data) {
    this.logger.debug('post(option, data)', option, data)
    this.logger.test('post(option, data)', 'verbose')
    let result = this._invoke({
      method: 'post',
      args: [].slice.call(arguments)
    })
    if (result.ok) {
      result.$ = util.get$(result.url, result.html)
    }
    this.logger.test('post(option, data)', 'verbose', result.ok)
    return result
  }

  code (option, selector) {
    this.logger.debug('code(option, selector)', option, selector)
    this.logger.test('code(option, selector)', 'verbose')
    let result = this._invoke({
      method: 'code',
      args: [].slice.call(arguments)
    })
    this.logger.test('code(option, selector)', 'verbose', result.ok + ',' + result.text)
    return result.text
  }

  push (urls, refer, priority) {
    this.logger.debug('push(urls, refer, priority)', urls, refer, priority)
    this.logger.test('push', 'verbose')
    let result = this._invoke({
      method: 'push',
      args: [].slice.call(arguments)
    })
    this.logger.test('push', 'verbose', result.ok)
    return result
  }

  text (str) {
    this.logger.debug('test(str)', str)
    return util.text(str)
  }
}

module.exports = SyncUtil

/* let S = new SyncUtil({
    db: "mongodb://192.168.2.56/test",
    name: 'demo',
});

 console.log(S.get({
    //url:'https://www.wikiart.org/en/claude-monet/all-works',//1000+
    url:'https://www.wikiart.org/en/hans-von-aachen/all-works',//2
    //url:'https://www.wikiart.org/en/m-c-escher/all-works',//400+
    render:true,
    loadImages:true,
    actions: [{
        wait: 1000
    },{
        scrollToBottom: {}
    },{
        clickMore: {selector:'#btn-more'}
    }]
}))*/
// console.log(S.get("https://www.baidu.com/"))
// console.log(S.push("https://www.baidu.com/"))
// console.log(S.code('http://artlib.org/loginController.do?login', '#randCodeImage'))
/* console.log(S.push([{
    url:'/all-works',
    actions: [{
        clickMore: {selector:'#btn-more'}
    }]
}])) */
