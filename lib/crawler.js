/**
 * Created by yneos on 2017/4/17.
 * need --harmony-async-await
 */
const path = require('path')
const Observable = require('./base/observable.js')
const AsynUtil = require('./sync/AsynUtil')
const SyncUtil = require('./sync/SyncUtil')
const util = require('./util/util.js')
const mkdirp = require('mkdirp')

const defaultConfig = {
  cron: '',
  name: '', // 必填
  level: 'info', // debug|verbose|info|warn|error
  db: '', // 必填'mongodb://user:pass@localhost:port,anotherhost:port,yetanother:port/mydatabase'
  sysdb: null,
  startUrl: '',
  targetReg: null,
  helpReg: null,
  interval: 1000,
  schema: null, // 必填{type:String,index:true,default:",key:true,merge}
  allowUpdate: true,
  userAgent: 'PC',
  randomUA: true, // UserAgent轮询
  proxy: '', // 127.0.0.1:8910
  proxyAuth: '', // username:password
  proxyType: 'http', // [http|socks5|none]
  cookies: false,
  enableJS: false,
  loadImages: false,
  needLogin: false,
  cycle: true,
  downloadPath: '',
  timeout: 15000
}

let asynUtil = null
class Crawler extends Observable {
  constructor (options) {
    options = options || {}
    const fileFullName = process.argv[2] ? path.resolve(process.argv[2]) : process.argv[1]
    let name = path.basename(fileFullName)
    const logConfig = {
      fileDirName: path.dirname(fileFullName),
      fileName: name + '.log',
      file: false
    }
    options = Object.assign({}, defaultConfig, options, logConfig)
    options.moduleName = 'Crawler'
    super(options)

    if (!options.name || !options.db) {
      throw new Error('配置项：name、db 不能为空')
    }
    if (options.needLogin) options.cookies = true
    Object.assign(this, options)

    if (options.downloadPath) {
      mkdirp.sync(options.downloadPath)
    }

    asynUtil = new AsynUtil(options)
    this.SyncUtil = new SyncUtil(options)

    this._targetRegs = this._initTargetRegs()
    this._helpRegs = this._initHelpRegs()

    this.running = false
    this.count = 0
    process.on('SIGINT', this.stop.bind(this))
  }

  _initTargetRegs () {
    let self = this, targetRegs = []
    if (self.targetReg && !(self.targetReg instanceof Array)) {
      self.logger.debug('targetReg存在且不是数组')
      if (self.targetReg.test) {
        self.logger.debug('targetReg.test存在，放入targetRegs')
        targetRegs.push(self.targetReg)
      }
    } else {
      if (self.targetReg instanceof Array) {
        self.logger.debug('targetReg是数组')
        self.targetReg.forEach(reg => {
          if (reg.test) {
            self.logger.debug('targetReg.test存在，放入targetRegs')
            targetRegs.push(reg)
          }
        })
      }
    }
    return targetRegs
  }

  _initHelpRegs () {
    let self = this, helpRegs = []
    if (self.helpReg && !(self.helpReg instanceof Array)) {
      self.logger.debug('helpReg存在且不是数组')
      if (self.helpReg.test) {
        self.logger.debug('helpReg.test存在，放入targetRegs')
        helpRegs.push(self.helpReg)
      }
    } else {
      if (self.helpReg instanceof Array) {
        self.logger.debug('helpReg是数组')
        self.helpReg.forEach(reg => {
          if (reg.test) {
            self.logger.debug('helpReg.test存在，放入targetRegs')
            helpRegs.push(reg)
          }
        })
      }
    }
    return helpRegs
  }

  _isTarget (link) {
    let self = this
    for (let i in self._targetRegs) {
      let reg = self._targetRegs[i]
      if (reg.test(link) && !/#/.test(link)) {
        self.logger.debug('_isTarget', link, 'true')
        return true
      } else {
        self.logger.debug('_isTarget', link, 'false')
      }
    }
  }

  _isHelp (link) {
    let self = this
    for (let i in self._helpRegs) {
      let reg = self._helpRegs[i]
      if (reg.test(link) && !/#/.test(link)) {
        self.logger.debug('_isHelp', link, 'true')
        return true
      } else {
        self.logger.debug('_isHelp', link, 'false')
      }
    }
  }

  _findLink (url, $, html) {
    let self = this, urls = [], helpUrls = [], targetUrls = []
    return new Promise((resolve, reject) => {
      try {
        this.logger.verbose('调用 doFindLink(url, $, html)')
        let result = this.doFindLink(url, $, html)
        if (result === false) {
          this.logger.verbose('用户屏蔽自动发现')
          resolve()
          return
        } else {
          if ((result instanceof String) && result) {
            if (self._isHelp(result) || self._isTarget(result)) urls.push(result)
          }
          if ((result instanceof Array) && result.length > 0) {
            result.forEach(link => {
              if (self._isHelp(link) || self._isTarget(link)) urls.push(link)
            })
          }
        }
      } catch (err) {
        this.logger.error(err)
      }

      $('a[href]').each(function () {
        let link = $(this).attr('href')
        if (link) {
          if (self._isHelp(link)) {
            helpUrls.push(link)
          }
          if (self._isTarget(link)) {
            targetUrls.push(link)
          }
        }
      })

      this.logger.info('发现连接：' + (helpUrls.length + targetUrls.length + urls.length))
      asynUtil.push(helpUrls, url, -1)
        .then(() => {
          return asynUtil.push(targetUrls, url)
        })
        .then(() => {
          return asynUtil.push(urls, url)
        })
        .then(() => {
          resolve()
        })
        .catch(err => {
          reject(err)
        })
    })
  }

  async start () {
    try {
      if (this.running) return
      this.running = true
      this.stime = Date.now()
      this.logger.info('启动', this.name)
      await asynUtil.start()
      try {
        this.logger.log('调用 beforeStart()')
        this.beforeStart()
      } catch (err) {
        this.logger.error('beforeStart()', err)
      }

      if (this.needLogin) {
        let isMaster = await asynUtil.isMaster()
        if (isMaster) {
          await asynUtil.clearCookie()
          await asynUtil.setLoginState('')
          this.logger.debug('调用 login()')
          try {
            let ok = false
            for (var i = 0; i < 4; i++) {
              if (this.login()) {
                ok = true
                await asynUtil.setLoginState('ok')
                this.logger.log('登陆成功')
                break
              }
              this.logger.log('登陆失败,重试', i)
            }
            if (!ok) {
              await asynUtil.setLoginState('no')
              await this.stop('登陆失败')
            }
          } catch (err) {
            this.logger.error('login()', err)
          }
        } else {
          let i = 0 ;
          while (true) {
            i++;
            this.logger.info(this.name, '等待 Master login()...')
            let doc = await asynUtil.getLoginState()
            if (doc.loginState === 'ok') {
              break
            }
            if (doc.loginState === 'no' || i > 50) {
              await this.stop('登陆失败或等待时间过长，从节点退出...')
              break
            }
            await this._wait(5 * 1000)
          }
        }
      }

      let empty = await asynUtil.isEmpty()
      if (empty && this.startUrl) {
        await asynUtil.push(this.startUrl)
      }

      while (!(await asynUtil.isFinish())) {
        let q = await asynUtil.pop()
        if (!q) {
          this.logger.warn('未取到队列,continue')
          await this._wait(3000)
          continue
        }
        this.count++
        this.logger.test('处理用时', 'info')
        let option = q.data

        try {
          this.logger.verbose('调用 beforeRequest(option)')
          this.beforeRequest(option)
        } catch (err) {
          this.logger.error(err)
        }
        this.logger.info(option.method, option.url, 'index:', this.count)
        let res = await asynUtil.request(option)

        if (res.ok) {
          let url = option.url
          let html = res.html
          let $ = util.get$(url, html)
          try {
            this.logger.verbose('调用 onLoad(url, $, html)')
            this.onLoad(url, $, html)
          } catch (err) {
            this.logger.error(err)
          }
          try {
            this.logger.verbose('调用 isAntiSpider(url, $, html)')
            if (this.isAntiSpider(url, $, html)) {
              this.logger.warn('已被反爬,即将停止')
              await this.stop()
            }
          } catch (err) {
            this.logger.error(err)
          }

          await this._findLink(url, $, html)
          if (url === this.startUrl) {
            try {
              this.logger.verbose('调用 doStartPage(url, $, html)')
              let data = this.doStartPage(url, $, html)
              if (data) {
                data._url = url
                await asynUtil.save(data)
              }
            } catch (err) {
              this.logger.error(err)
            }
          }

          if (this._isHelp(url) || q.data.isHelp) {
            try {
              this.logger.verbose('调用 doHelpPage(url, $, html)')
              let data = this.doHelpPage(url, $, html)
              if (data) {
                data._url = url
                await asynUtil.save(data)
              }
            } catch (err) {
              this.logger.error(err)
            }
          }

          if (this._isTarget(url) || q.data.isTarget) {
            try {
              this.logger.verbose('调用 doTargetPage(url, $, html)')
              let data = this.doTargetPage(url, $, html)
              if (data) {
                data._url = url
                await asynUtil.save(data)
              } else {
                this.logger.warn('无数据')
              }
            } catch (err) {
              this.logger.error(err)
            }
          }

          await asynUtil.success(q)
        } else {
          this.logger.warn(q.data.method, q.data.url, '请求失败')
          await asynUtil.failed(q)
        }
        await asynUtil.statistics()
        await this._wait(this.interval)
        this.logger.test('处理用时', 'info', res.ok ? '成功' : '失败')
      }
      await this._complete()
    } catch
      (err) {
      if (this.level.toLowerCase() === 'debug') {
        console.log(err)
        setTimeout(() => {
          process.exit(1)
        }, 1000)
      } else {
        this.logger.error(err)
      }
    }
  }

  stop (reason) {
    reason = reason || ''
    var self = this
    return new Promise(function (resolve, reject) {
      asynUtil.stop(reason, self.cycle)
        .then(() => {
          return asynUtil.removeFromCluster()
        })
        .then(() => {
          return asynUtil.closeAll()
        })
        .then(() => {
          self.logger.info('停止 ', reason)
          self.running = false
          self.count = 0
          self.emit('stop', reason)
          resolve()
          process.exit(0)
        })
        .catch((err) => {
          self.emit('stop', reason)
          self.logger.error(err)
          resolve()
          process.exit(0)
        })
    })
  }

  _complete () {
    let self = this
    let etime = Date.now()
    self.logger.info('用时', util.dateDiff(etime - self.stime))
    self.emit('complete')
    return self.stop('完成')
  }

  _changeProxy () {
    // todo
  }

  _wait (num) {
    num = num || 1000
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve()
      }, num)
    })
  }

  beforeStart () {
  }

  login () {
  }

  beforeChangeProxy () {
  }

  beforeRequest (option) {
  }

  onLoad (url, $, html) {
  }

  isAntiSpider (url, $, html) {
  }

  doFindLink (url, $, html) {
  }

  doStartPage (url, $, html) {
  }

  doHelpPage (url, $, html) {
  }

  doTargetPage (url, $, html) {
  }
}

module.exports = Crawler
