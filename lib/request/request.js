/**
 * Created by yneos on 2017/4/18.
 * http://phantomjs.org/api/
 * https://github.com/amir20/phantomjs-node
 * http://caolan.github.io/async/
 */
const Url = require('url')
const querystring = require('querystring')
const Phantom = require('phantom')
const async = require('async')
const Observable = require('../base/observable.js')
const Actions = require('./actions.js')
const path = require('path')
const util = require('../util/util.js')
const DEFAULT_OPTION = {
  url: '',
  enableJS: true,
  method: 'GET',
  headers: null,
  userAgent: '',
  randomUA: true,
  referer: '',
  data: null,
  jsonContent: false, // [string,json]
  proxy: '', // 127.0.0.1:8910
  proxyAuth: '', // username:password
  proxyType: 'http', // [http|socks5|none]
  cookies: null,
  timeout: 15000,
  loadImages: false,
  render: false,
  wait: 600,
  viewportSize: {width: 1024, height: 768},
  actions: []// click,wait,input,scrollTo
}

class Request extends Observable {
  constructor(options) {
    options = options || {}
    options = Object.assign(options, {
      moduleName: 'Request'
    })
    super(options)
    this.requestQueue = async.queue(this._open.bind(this), 1)
    this.requestCount = 0
    this.lastOption = DEFAULT_OPTION
    this.instanse = null
    this.page = null
    this.running = false
    // process.on('SIGTERM', this._killInstance.bind(this));
    // process.on('SIGINT', this._killInstance.bind(this));
    process.on('exit', this._killInstance.bind(this))
  }

  close() {
    this.logger.debug('close()')
    let self = this
    return util.emptyPromise()
      .then(function () {
        if (self.page) {
          return self.page.stop()
        } else {
          return util.emptyPromise()
        }
      })
      .then(function () {
        if (self.page) {
          return self.page.close()
        } else {
          return util.emptyPromise()
        }
      })
      .then(function () {
        if (self.instanse) {
          return self.instanse.exit()
        } else {
          return util.emptyPromise()
        }
      })
      .then(function () {
        self.page = null
        self.instanse = null
        return util.emptyPromise()
      })
  }

  _killInstance() {
    this.logger.debug('_killInstance')
    try {
      this.instanse.kill()
    } catch (e) {
      // ignore
    }
    this.page = null
    this.instanse = null
  }

  _getInstance(option) {
    this.logger.debug('_getInstance', option)
    let args = [// see http://phantomjs.org/api/command-line.html
        '--ignore-ssl-errors=yes',
        '--ssl-protocol=any',
        '--load-images=no'],
      self = this
    if (option.proxy) {
      args.push('--proxy=' + option.proxy)
      if (option.proxyAuth) args.push('--proxy-auth=' + option.proxyAuth)
      if (option.proxyType) args.push('--proxy-type=' + option.proxyType)
    }
    // if (option.cookies) args.push('--cookies-file=./cookies.txt');
    // if (option.debug) args.push('--debug=true');
    return new Promise(function (resolve, reject) {
      if (self.instanse) {
        resolve(self.instanse)
        return
      }
      Phantom.create(args, {
        logLevel: 'error'/*,
        logger: {
          error: util.emptyFuncion(),
          warn: util.emptyFuncion(),
          info: util.emptyFuncion(),
          log: util.emptyFuncion(),
          debug: util.emptyFuncion()
        }*/
      })
        .then(function (instance) {
          self.instanse = instance
          resolve(self.instanse)
        })
        .catch(function (err) {
          self.logger.error('_getInstance', err)
          reject(err)
        })
    })
  }

  _getPage(option) {
    this.logger.debug('_getPage', option)
    let self = this
    return new Promise(function (resolve, reject) {
      if (self.page) {
        resolve(self.page)
      } else {
        self.instanse.createPage()
          .then(function (page) {
            self.page = page
            self.page.on('onInitialized', function (msg, lineNum, sourceId) {
              self.page.evaluate(function () {
                if (window.callPhantom) window.callPhantom = null
                if (window._phantom) window._phantom = null
              }, null)
            })
            self.page.on('onConsoleMessage', function (msg, lineNum, sourceId) {
              self.logger.debug('CONSOLE: ' + msg + ' (from line #' + lineNum + ' in "' + sourceId + '")')
            })
            self.page.on('onError', function (msg, trace) {
              let msgStack = ['ERROR: ' + msg]
              if (trace && trace.length) {
                msgStack.push('TRACE:')
                trace.forEach(function (t) {
                  msgStack.push(' -> ' + t.file + ': ' + t.line + (t.function ? ' (in function "' + t.function + '")' : ''))
                })
              }
              self.logger.debug('_getPage:PageOnError', msgStack.join('\n'))
            })

            resolve(self.page)
          })
          .catch(function (err) {
            self.logger.error('_getPage', err)
            reject(err)
          })
      }
    })
  }

  _setCookies(option) {
    this.logger.debug('_setCookies', option)
    let self = this
    if (!option.cookies) {
      return util.emptyPromise()
    } else {
      return self.page.property('cookies', option.cookies);
    }
    /*return new Promise(function (resolve, reject) {
     if (option.cookies) {
     self.page.property('cookies', option.cookies)
     .then(() => {
     resolve()
     })
     .catch(function (err) {
     self.logger.error('_setCookies', err)
     reject(err)
     })
     } else {
     resolve()
     }
     })*/
  }

  _getOpenSetting(option) {
    this.logger.debug('_getOpenSetting', option)
    let headers = {}, settings = {}
    settings.operation = option.method.toUpperCase()
    if (option.data) {
      if (settings.operation === 'POST') {
        if (option.jsonContent) {
          headers['Content-Type'] = 'application/json'
        } else {
          headers['Content-Type'] = 'application/x-www-form-urlencoded'
        }
        if (option.data instanceof String) {
          settings.data = querystring.escape(option.data)
        } else {
          settings.data = querystring.stringify(option.data)
        }
      }
      if (settings.operation === 'GET') {
        let parse = Url.parse(option.url, true, true)
        if (option.data instanceof String) {
          let obj = querystring.parse(option.data)
          parse.query = Object.assign({}, obj)
        } else {
          parse.query = Object.assign({}, option.data)
        }
        option.url = Url.format(parse)
      }
    }
    if (option.referer) {
      headers['Referer'] = option.referer
    }
    if (option.encoding) {
      settings.encoding = option.encoding
    }

    if (option.headers) {
      headers = Object.assign(headers, option.headers)
    }
    settings.headers = headers
    return settings
  }

  _setPage(option) {
    this.logger.debug('_setPage', option)
    let self = this
    return new Promise(function (resolve, reject) {
      self.page.setting('javascriptEnabled', option.enableJS)
        .then(function () {
          return self.page.setting('userAgent', option.userAgent)
        })
        .then(function () {
          return self.page.setting('loadImages', option.loadImages)
        })
        .then(function () {
          return self.page.clearCookies()
        })
        .then(function () {
          return self._setCookies(option)
        })
        .then(function () {
          return self.page.setting('resourceTimeout', option.timeout)
        })
        .then(function () {
          return self.page.property('viewportSize', option.viewportSize)
        })
        .then(function () {
          resolve()
        })
        .catch(function (err) {
          self.logger.error('_setPage', err)
          reject(err)
        })
    })
  }

  _wait(num) {
    this.logger.debug('_wait', num)
    return new Promise(function (resolve, reject) {
      setTimeout(function () {
        resolve()
      }, num)
    })
  }

  _render(option) {
    let self = this
    self.logger.debug('_render', option)
    return new Promise(function (resolve, reject) {
      if (self.page && option.render) {
        let file = process.argv[1] + '.render.png'
        self.logger.debug('_render file:', file)
        self.page.render(file)
          .then(function () {
            resolve()
          })
          .catch(function (err) {
            self.logger.error('_render', err)
            reject(err)
          })
      } else {
        resolve()
      }
    })
  }

  _open(option, callback) {
    this.logger.debug('_open', option)
    option = Object.assign({}, DEFAULT_OPTION, option)
    let settings = this._getOpenSetting(option)
    this.requestCount++
    this.lastOption = option
    let self = this,
      result = {
        url: option.url,
        ok: false,
        html: '',
        datas: null,
        error: null,
        cookies: null
      }

    util.emptyPromise()
      .then(function () {
        if (self.requestCount % 100 === 0 || self.lastOption.proxy !== option.proxy) {
          self.requestCount = 0
          return self.close()
        } else {
          return util.emptyPromise()
        }
      })
      .then(function () {
        return self._getInstance(option)
      })
      .then(function () {
        return self._getPage(option)
      })
      .then(function () {
        return self._setPage(option)
      })
      .then(function () {
        // return self.page.invokeAsyncMethod('open', option.url, settings)
        return self.page.open(option.url, settings)
      })
      .then(function (ret) {
        if (ret === 'success') {
          result.ok = true
        }
        let options = self.options
        options.page = self.page
        let action = new Actions(options)
        return action.do(option.actions)
      })
      .then(function (datas) {
        if (datas) result.datas = datas
        return self.page.property('cookies')
      })
      .then(function (cookies) {
        result.cookies = cookies
        return self._wait(option.wait)
      })
      .then(function () {
        return self._render(option)
      })
      .then(function () {
        return self.page.property('content')
      })
      .then(function (content) {
        result.html = content
        return self.page.close()
      })
      .then(function () {
        self.page = null
        callback(null, result)
      })
      .catch(function (err) {
        result.error = err
        self.logger.error('_open', err)
        callback(null, result)
      })
  }

  _getOption(option) {
    let self = this
    /* let op = {
     enableJS: self.options.enableJS,
     userAgent: self.options.userAgent,
     randomUA: self.options.randomUA,
     proxy: self.options.proxy,
     proxyAuth: self.options.proxyAuth,
     proxyType: self.options.proxyType,
     cookies: self.options.cookies,
     loadImages: self.options.loadImages,
     } */
    let op = Object.assign({}, DEFAULT_OPTION, option)
    this.logger.debug('_getOption<--', op)
    return op
  }

  request(option) {
    if (typeof option === 'string') {
      option = {url: option}
    }
    option = this._getOption(option)
    this.logger.debug('request', JSON.stringify(option))
    this.logger.test(option.method + ' ' + option.url, 'verbose')
    let self = this
    return new Promise(function (resolve, reject) {
      self.running = true
      self.requestQueue.push(option, function (err, res) {
        self.running = false
        self.logger.test(option.method + ' ' + option.url, 'verbose', 'ok:' + res.ok)
        if (err) {
          self.logger.error('request', err)
          reject(err)
        } else {
          resolve(res)
        }
      })
    })
  }

  get(option, data) {
    this.logger.debug('get', JSON.stringify(option), JSON.stringify(data))
    if (typeof option === 'string') {
      option = {url: option}
    }
    if (data) {
      option.data = data
    }
    option.method = 'GET'
    return this.request(option)
  }

  post(option, data) {
    this.logger.debug('post', JSON.stringify(option), JSON.stringify(data))
    if (typeof option === 'string') {
      option = {url: option}
    }
    if (data) {
      option.data = data
    }
    option.method = 'POST'
    return this.request(option)
  }
}

module.exports = Request

/*let R = new Request({});

 R.get({
 url:'http://artso.artron.net/jewel/search_jewel.php?&page=3',
 wait: 600,
 render:false,
 enableJS: true,
 loadImages: true,
 })
 .then((ret)=> {
 console.log(ret)
 process.exit()
 })
 .catch(err=> {
 console.error(err)
 process.exit()
 })*/
