/**
 * Created by yneos on 2017/4/17.
 * 需要封装在SyncUtil中的导步实现
 * 所有方法均返回Promise对象,并且需要经过同步工具调用的只能返回JSON数组
 */
const Url = require('url')
const Observable = require('../base/observable.js')
const util = require('../util/util.js')
const Request = require('../request/request.js')
const Queue = require('../queue/mongoQueue.js')
const CookieStore = require('../cookies/cookieStore.js')
const Persist = require('../persist/persist.js')
const Cluster = require('../cluster/cluster.js')
const UAG = require('../util/userAgentGenerator.js')
const cookieConverter = require('../cookies/cookieConverter')
const Downloader = require('../request/downloader')
const State = require('../cluster/state')

class AsynUtil extends Observable {
  constructor (options) {
    options = options || {}
    options.moduleName = 'AsynUtil'
    super(options)
    this.R = new Request(options)
    this.queue = new Queue(options)
    this.cookie = new CookieStore(options)
    this.persist = new Persist(options)
    this.cluster = new Cluster(options)
    this.downloader = new Downloader(options)
    this.state = new State(options)
  }

  _processOption (option, obj) {
    if (typeof option === 'string') {
      option = {url: option}
    }
    if (obj) {
      option = Object.assign({}, option, obj)
    }
    option = this._getRequestOption(option)
    return option
  }

    // Request
  request (option) {
    let self = this
    this.logger.debug('request(option)', option)
    option = this._processOption(option)

    if (option.method.toLocaleLowerCase() === 'download') {
      return self.download(option)
    }

    if (!this.options.cookies) {
      return this.R.request(option)
    } else {
      return new Promise((resolve, reject) => {
        let parse = Url.parse(option.url)
        let result = null
        self.cookie.find(parse.hostname, parse.pathname)
                    .then((cookies) => {
                      option.cookies = cookies
                      return self.R.request(option)
                    })
                    .then((ret) => {
                      result = ret
                      let cookies = ret.cookies ? ret.cookies : []
                      return self.cookie.save(cookies)
                    })
                    .then(() => {
                      self.logger.debug('request(option)<--', result)
                      resolve(result)
                    })
                    .catch((err) => {
                      self.logger.error('request(option)', err)
                      resolve({ok: false, error: err})
                    })
      })
    }
  }

  get (option, data) {
    this.logger.debug('get(option, data)', option, data)
    option = this._processOption(option, {method: 'GET'})
    if (data) option.data = data
    return this.request(option)
  }

  post (option, data) {
    this.logger.debug('post(option, data)', option, data)
    option = this._processOption(option, {method: 'POST'})
    if (data) option.data = data
    return this.request(option)
  }

  code (option, selector) {
    this.logger.debug('code(option, selector)', option, selector)
    let self = this
    option = this._processOption(option, {
      method: 'GET',
      enableJS: true,
      cookies: true,
      loadImages: true,
      actions: [{
        getImg: {selector: selector}
      }]
    })

    return new Promise((resolve, reject) => {
      self.request(option)
                .then((ret) => {
                  let data = ret.datas[0]
                  if (!data) {
                    throw new Error('there is no image data return')
                  }
                  let tesseract = require('tesseract.js')
                  var base64Data = data.replace(/^data:image\/\w+;base64,/, '')
                  var dataBuffer = new Buffer(base64Data, 'base64')
                  return tesseract.recognize(dataBuffer)
                })
                .then((ret) => {
                  let r = {
                    ok: true,
                    text: util.text(ret.text),
                    confidence: ret.confidence
                  }
                  this.logger.debug('code(option, selector)<--', r)
                  resolve(r)
                })
                .catch(function (err) {
                  self.logger.error('code(option, selector)', err)
                  resolve({ok: false, error: err, text: '', confidence: ''})
                })
    })
  }

  download (option) {
    this.logger.debug('download(option)', option)
    let self = this
    return new Promise((resolve, reject) => {
      util.emptyPromise()
                .then(() => {
                  if (self.options.cookies) {
                    let parse = Url.parse(option.url)
                    return self.cookie.find(parse.hostname, parse.pathname)
                  } else {
                    return util.emptyPromise()
                  }
                })
                .then((cookies) => {
                  let ops = {}
                  ops.url = option.url
                  ops.fileName = option.fileName
                  ops.headers = {}
                  if (option.userAgent) {
                    ops.headers['User-Agent'] = option.userAgent
                  }
                  if (option.referer) {
                    ops.headers['Referer'] = option.referer
                  }
                  if (option.proxy) {
                    let p = Url.parse(option.proxy)
                    p.protocol = option.proxyType
                    p.auth = option.proxyAuth
                    ops.proxy = Url.format(p)
                  }
                  if (cookies) {
                    ops.cookies = cookieConverter.phantomCookes2Request(cookies) || []
                  }
                  ops.timeout = option.timeout
                  return self.downloader.download(ops)
                })
                .then((ret) => {
                  resolve(ret)
                })
                .catch((err) => {
                    // self.logger.error('download(option) Error', err);
                  resolve({ok: false, error: err})
                })
    })
  }

    // Queue
  _getUserAgentString (option) {
    let self = this
    this.logger.debug('_getUserAgentString', option)
    if (!option.randomUA) { // 固定UA
      if (UAG.isInKey(option.userAgent)) {
        if (!self.ua) self.ua = UAG.getOne(option.userAgent)
        return self.ua
      } else {
        return option.userAgent
      }
    } else { // 动态UA
      if (UAG.isInKey(option.userAgent)) {
        return UAG.getOne(option.userAgent)
      } else {
        return option.userAgent
      }
    }
  }

  _getRequestOption (url, refer) {
    this.logger.debug('_getRequestOption(url, refer)', url, refer)
    let o = {}
    if (typeof url === 'string') {
      o.url = url
    } else {
      o = Object.assign({}, {}, url)
    }
    if (refer) {
      o.referer = refer
    }
    let option = {
      url: '',
      enableJS: this.options.enableJS || true,
      method: 'GET',
      headers: null,
      userAgent: this.options.userAgent || 'PC',
      randomUA: this.options.randomUA || true,
      referer: refer || '',
            // data: null,
      jsonContent: false,
      proxy: this.options.proxy || '',
      proxyAuth: this.options.proxyAuth || '',
      proxyType: this.options.proxyType || 'http',
      cookies: this.options.cookies || null,
      timeout: this.options.timeout,
      loadImages: this.options.loadImages || false,
      render: false,
      wait: 600,
      actions: []
    }
    let obj = Object.assign({}, option, o)

    if (option.userAgent.toUpperCase() === 'MB') {
      this.logger.debug('---------->480*800')
      obj.viewportSize = {width: 480, height: 800}
    } else {
      this.logger.debug('---------->1024*768')
      obj.viewportSize = {width: 1024, height: 768}
    }

    obj.userAgent = this._getUserAgentString(obj)
    if (obj.actions.length > 0) {
      obj.enableJS = true
    }
    this.logger.debug('_getRequestOption(url, refer)<--', obj)
    return obj
  }

  push (urls, refer, priority) {
    this.logger.debug('push(urls, refer, priority)', urls, refer, priority)
    let self = this
    if (!(urls instanceof Array)) {
      urls = [urls]
    }
    let options = []
    urls.forEach((url) => {
      let option = self._getRequestOption(url, refer)
      options.push(option)
    })
    return new Promise((resolve, reject) => {
      self.queue.push(options, priority)
                .then(() => {
                  resolve()
                })
                .catch(err => {
                  this.logger.error('push(urls, refer, priority)', err)
                  reject({ok: false, error: err})
                })
    })
  }

  pop () {
    this.logger.debug('pop()')
    return this.queue.pop()
  }

  success (queue) {
    this.logger.debug('success(queue)', queue)
    return this.queue.success(queue)
  }

  failed (queue) {
    this.logger.debug('failed(queue)', queue)
    return this.queue.failed(queue)
  }

  isEmpty () {
    this.logger.debug('isEmpty()')
    return this.queue.isEmpty()
  }

  isFinish () {
    this.logger.debug('isFinish()')
    return this.queue.isAllFinish()
  }

  clearQueue () {
    this.logger.debug('clearQueue()')
    return this.queue.clear()
  }

    // Cookies
  clearCookie () {
    this.logger.debug('clearCookie()')
    return this.cookie.clear()
  }

    // Persist
  save (datas) {
    this.logger.debug('save(datas)', datas)
    return this.persist.save(datas)
  }

    // Cluster
  isMaster () {
    this.logger.debug('isMaster()')
    return this.cluster.isMaster()
  }

  getLoginState () {
    return this.cluster.getLoginState()
  }

  setLoginState (str) {
    return this.cluster.setLoginState(str)
  }

  start () {
    this.logger.debug('start()')
    let self = this
    return new Promise(function (resolve, reject) {
      self.cluster.isMaster()
                .then((master) => {
                  if (master) {
                    return self.state.start()
                  } else {
                    return util.emptyPromise()
                  }
                })
                .then(() => {
                  resolve()
                })
                .catch((err) => {
                  reject(err)
                })
    })
  }

  statistics () {
    this.logger.debug('statistics')
    let self = this
    let createAt, startAt, queueCount, queueFinishedCount, queueCountSinceStart, dataCount, dataCountSinceStart, instanceNum
    return new Promise(function (resolve, reject) {
      self.cluster.isMaster()
                .then((master) => {
                  if (master) {
                    return self.state.get()
                            .then(doc => {
                              createAt = doc.createAt
                              startAt = doc.startAt
                              return self.queue.count()
                            })
                            .then(count => {
                              queueCount = count
                              return self.queue.countFinish()
                            })
                            .then(count => {
                              queueFinishedCount = count
                              return self.queue.countSince(startAt)
                            })
                            .then(count => {
                              queueCountSinceStart = count
                              return self.persist.count()
                            })
                            .then(count => {
                              dataCount = count
                              return self.persist.countSince(startAt)
                            })
                            .then(count => {
                              dataCountSinceStart = count
                              return self.cluster.count()
                            })
                            .then(count => {
                              instanceNum = count
                              return self.state.statistics(createAt, startAt, queueCount, queueFinishedCount, queueCountSinceStart,
                                    dataCount, dataCountSinceStart, instanceNum)
                            })
                            .then(() => {
                              resolve()
                            })
                  } else {
                    resolve()
                  }
                })
                .catch(err => {
                  reject(err)
                })
    })
  }

  stop (reason, cycle) {
    this.logger.debug('stop()')
    let self = this
    return self.cluster.isMaster()
            .then((master) => {
              if (master) {
                if (reason === '完成') {
                  return util.emptyPromise()
                            .then(() => {
                              if (cycle) {
                                return self.clearAll()
                              } else {
                                return util.emptyPromise()
                              }
                            })
                            .then(() => {
                              return self.state.complete()
                            })
                } else {
                  return self.state.stop()
                }
              } else {
                return util.emptyPromise()
              }
            })
  }

  complete () {
    this.logger.debug('complete()')
    let self = this
    return new Promise(function (resolve, reject) {
      self.cluster.isMaster()
                .then((master) => {
                  if (master) {
                    return self.state.complete()
                  } else {
                    return util.emptyPromise()
                  }
                })
                .then(() => {
                  resolve()
                })
                .catch((err) => {
                  reject(err)
                })
    })
  }

  removeFromCluster () {
    this.logger.debug('isMaster()')
    return this.cluster.deleteMySelf()
  }

  clearCluster () {
    this.logger.debug('clearCluster()')
    return this.cluster.clear()
  }

    /**
     * 关闭所有数据库连接
     */
  closeAll () {
    this.logger.debug('closeAll()')
    let self = this
    return new Promise(function (resolve, reject) {
      self.cookie.close()
                .then(() => {
                  return self.queue.close()
                })
                .then(() => {
                  return self.persist.close()
                })
                .then(() => {
                  return self.cluster.close()
                })
                .then(() => {
                  return self.state.close()
                })
                .then(() => {
                  return self.R.close()
                })
                .then(() => {
                  resolve()
                })
                .catch((err) => {
                  reject(err)
                })
    })
  }

  clearAll () {
    this.logger.debug('clearAll()')
    let self = this
    return new Promise(function (resolve, reject) {
      self.cookie.clear()
                .then(() => {
                  return self.cluster.clear()
                })
                .then(() => {
                  return self.queue.clear()
                })
                .then(() => {
                  resolve()
                })
                .catch((err) => {
                  reject(err)
                })
    })
  }
}

module.exports = AsynUtil

/*
 var A = new AsynUtil({
 db: "mongodb://192.168.2.56/test",
 name: "test",
 cookies: true,
 "downloadPath": "/tmp",
 });
 */

/* A.request(op)
 .then((ret)=> {
 console.log(ret);
 process.exit(0)
 })
 .catch((e)=> {
 console.error(e)
 }) */
/*
 A.push([{
 url:'http://www.baidu.com',
 actions:[{wait:3000}]
 },{
 url:'http://www.baidu.com2',
 actions:[{wait:3000}]
 }])
 .then((ret)=> {
 console.log(ret);
 return A.pop();
 })
 .then((ret)=> {
 console.log(ret);
 process.exit(0)
 })
 .catch((e)=> {
 console.error(e)
 })
 */
