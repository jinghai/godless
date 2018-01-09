/**
 * Created by yneos on 2017/5/12.
 */

const Schema = require('mongoose').Schema
const async = require('async')
const Observable = require('../base/observable.js')
const util = require('../util/util.js')

class CookieStore extends Observable {
  constructor (options) {
    options = options || {}
    options.moduleName = 'CookieStore'
    super(options)
    this.db = require('../base/db.js')(options.sysdb || options.db, options)
    let schema = new Schema({
      _id: {type: String},
      domain: {type: String, index: true},
      path: {type: String, default: '/', index: true},
      name: {type: String}
    }, {
      strict: false,
      versionKey: false,
      safe: false
    })
    let mName = options.name + '.cookies'
    this.model = this.db.model(mName, schema, mName)
    this.saveQueue = async.queue(this._save.bind(this), 5)
  }

  _checkData (data) {
    this.logger.debug('_save', JSON.stringify(data))
    if (!data.domain) return false
    if (!data.name) return false
    if (!data.path) data.path = '/'
    let domain = data.domain.charAt(0) !== '.' ? '.' + data.domain : data.domain
    data._id = util.md5(domain + data.path + data.name)
    return true
  }

  _save (data, callback) {
    this.logger.debug('_save', JSON.stringify(data))
    if (!this._checkData(data)) {
      callback('domain or path is empty:' + JSON.stringify(data))
      return
    }
    this.model.update({_id: data._id}, data, {safe: false, upsert: true, setDefaultsOnInsert: true})
            .then(() => {
              callback()
            })
            .catch(err => {
              callback(err)
            })
  }

  save (datas) {
    if (!(datas instanceof Array)) {
      datas = [datas]
    }
    let self = this, saveQueue = this.saveQueue
    self.logger.debug('save', JSON.stringify(datas))
    return new Promise((resolve, reject) => {
      if (datas.length == 0) {
        resolve()
        return
      }
      self.logger.test('save', 'verbose')
      saveQueue.drain = function () {
        self.logger.test('save', 'verbose', 'num:' + datas.length)
        resolve()
      }
      datas.forEach(data => {
        saveQueue.push(data, (err) => {
          if (err) self.logger.warn('save:', err)
        }
                )
      })
    })
  }

    /**
     * 查找以domain结尾并且以path开头的所有cookie
     * @param domain 必填
     * @param path 默认"/"
     * @returns {Promise} 返回Array
     */
  find (domain, path) {
    let result = null, self = this
        // 获取最后一个"/"之前的Path,不包含域名
    path = path.split('/')
    path.pop()
    path = path.join('/') || '/'
    self.logger.debug('find', domain, path)
    return new Promise((resolve, reject) => {
      if (!domain) {
        resolve(null)
        return
      }
      self.logger.test('find', 'verbose')
      self.model.find({
        domain: new RegExp(self._getTopDomain(domain) + '$', 'i'),
        path: new RegExp('^' + path, 'i')
      })
                .then(doc => {
                  self.logger.test('find', 'verbose', 'num:' + doc.length)
                  self.logger.debug('find', doc)
                  resolve(doc)
                })
                .catch(err => {
                  self.logger.error(err)
                  reject(err)
                })
    })
  }

  _getTopDomain (domain) {
    this.logger.debug('_getTopDomain', domain)
    let t = domain.split('.')
    if (t.length > 2) {
      return t[t.length - 2] + '.' + t[t.length - 1]
    }
    return domain
  }

  count () {
    this.logger.debug('count()')
    return this.model.count({})
  }

  clear () {
    this.logger.debug('clear')
    let model = this.model, self = this
    return model.remove({})
  }

  close () {
    this.logger.debug('close')
    return this.db.close()
  }
}
module.exports = CookieStore

/* let c = new CookieStore({
 db: "mongodb://192.168.2.56/test",
 name: "test"
 });
 c.save([
 { domain: '.baidu.com',path:'/',value:"/"},
 { domain: '.baidu.com',path:'/a',value:"/a"},
 { domain: '.baidu.com',path:'/a/b',value:"/a/b"},
 { domain: '.baidu.com',path:'/c',value:"/c"},
 { domain: 'www.baidu.com',path:'/d',value:"/d"},

 ])
 .then(()=> {
 return c.find('www.baidu.com','/');
 })
 .then((data)=> {
 console.log(data)
 })
 .catch(err=> {
 console.error(err)
 }) */
