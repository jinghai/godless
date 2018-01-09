/**
 * Created by Administrator on 2017/5/16.
 *
 * http://www.w3school.com.cn/cssref/css_selectors.asp
 */
const async = require('async')
const Observable = require('../base/observable.js')

class Actions extends Observable {
  constructor (options) {
    options = options || {}
    options.moduleName = 'Actions'
    super(options)
    this.page = options.page
  }

  wait (option, done) {
    this.logger.debug('wait() ' + option)
    setTimeout(function () {
      done()
    }, option)
  }

  click (option, done) {
    let selector = option.selector
    this.logger.debug('click() ' + selector)
    this.page.evaluate(function (selector) {
      var element = document.querySelector(selector)
      var event = document.createEvent('MouseEvent')
      event.initEvent('click', true, true)
      element.dispatchEvent(event)
    }, selector)
            .then(function () {
              done(null)
            })
            .catch(function (err) {
              done(err)
            })
  }

  clickMore (option, done) {
    let selector = option.selector, self = this
    this.logger.debug('clickMore() ' + selector)
    let isVisible = true
    async.whilst(
            function () {
              return isVisible
            },
            function (callback) {
              self.page.evaluate(function (selector) {
                window.scrollTo(0, document.body.scrollHeight)
                var el = document.querySelector(selector)
                if (el) {
                  var visible = !!((el.offsetWidth > 0 && el.offsetHeight > 0))
                        // console.log('isVisible', visible);
                  el.click()
                  return visible
                } else return false
              }, selector)
                    .then(function (visible) {
                      isVisible = visible
                      self.logger.debug('clickMore()->isVisible:', visible)
                      if (!visible) {
                        callback(null)
                      } else {
                        setTimeout(function () {
                          callback(null)
                        }, 5000)
                      }
                    })
                    .catch(function (err) {
                      callback(err)
                    })
            },
            function (err) {
              done(err)
            }
        )
  }

  input (option, done) {
    let selector = option.selector
    let text = option.text || ''
    this.logger.debug('type()', selector, text)
    var self = this
    this.page.evaluate(function (selector, text) {
      document.querySelector(selector).focus()
    }, selector, text)
            .then(function () {
              return self.page.sendEvent('keypress', text, null, null, 0)
                // return self.page.invokeMethod('sendEvent', 'keypress', text, null, null, 0)
            })
            .then(function () {
              done(null)
            })
            .catch(function (err) {
              done(err)
            })
  }

  scrollTo (option, done) {
    let top = option.top || 0
    let left = option.left || 0
    this.logger.debug('scrollTo() top: ' + top + ', left: ' + left)
    this.page.property('scrollPosition', {
      top: top,
      left: left
    })
            .then(function () {
              done(null)
            })
            .catch(function (err) {
              done(err)
            })
  }

  scrollToBottom (option, done) {
    this.logger.debug('scrollToBottom()')
    this.page.evaluate(function () {
      window.scrollTo(0, document.body.scrollHeight)
      return 'ok'
    }, null)
            .then(function (str) {
              done(null, str)
            })
            .catch(function (err) {
              done(err)
            })
  }

  getImg (option, done) {
    let selector = option.selector
    this.logger.debug('getImg() ' + selector)
    this.page.evaluate(function (selector) {
      var element = document.querySelector(selector)
            // 创建canvas DOM元素，并设置其宽高和图片一样
      var canvas = document.createElement('canvas')
      canvas.width = element.width
      canvas.height = element.height
            // 坐标(0,0) 表示从此处开始绘制，相当于偏移。
      canvas.getContext('2d').drawImage(element, 0, 0)
      var dataURL = canvas.toDataURL('image/png')
            // var img64 = dataURL.replace(/^data:image\/(png|jpg);base64,/,"")
      return dataURL
    }, selector)
            .then(function (data) {
              done(null, data)
            })
            .catch(function (err) {
              done(err)
            })
  }

  do (actions) {
    let self = this
    return new Promise(function (resolve, reject) {
      let datas = []
      if (!actions || !(actions instanceof Array) || actions.length === 0) {
        resolve(datas)
      }

      let queue = async.queue(function (task, done) {
        let fun = task.fun
        let option = task.option
        fun.call(self, option, done)
      }, 1)
      queue.drain = function () {
        resolve(datas)
      }
      let hasTask = false

      actions.forEach(function (actionObject) {
        for (let action in actionObject) {
          let option = actionObject[action]
          if (typeof option === 'string') {
            option = {selector: option}
          }
          let fun = self[action]
          if (typeof fun === 'function') {
            hasTask = true
            queue.push({fun: fun, option: option}, function (err, data) {
              if (err) self.logger.error('do.Error', err)
              if (data) {
                datas.push(data)
              }
            })
          }
        }
      })

      if (!hasTask) {
        resolve()
      }
    })
  }
}
module.exports = Actions
/*
 let A = new Actions();
 A.do({
 wait: 1000,
 type: {selector: '#kw', value: 'yneos'},
 click: "#su"
 }).then(()=> {
 console.log('ok')
 }) */
