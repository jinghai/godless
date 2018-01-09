/**
 * Created by yneos on 2017/5/12.
 */

const Schema = require('mongoose').Schema
const Observable = require('../base/observable.js')
const util = require('../util/util.js')

class Cluster extends Observable {
  constructor (options) {
    options = options || {}
    options.moduleName = 'Cluster'
    super(options)
    this.db = require('../base/db.js')(options.sysdb || options.db, options)
    let self = this
    this.myId = this._getMyId()
    this.myDescribe = this._getDescribe()
    let schema = new Schema({
      _id: {type: String, default: self.myId},
      name: {type: String, default: self.options.name},
      describe: {type: String, default: self.myDescribe},
      master: {type: Boolean, default: false},
      createAt: {type: Date, default: Date.now},
      updateAt: {type: Date, default: Date.now, expires: '5m'},
      loginState: {type: String, default: ''}
    }, {
      strict: true,
      versionKey: false,
      safe: true
    })
    let mName = options.name + '.cluster'
    this.model = this.db.model(mName, schema, mName)
    // let delay = Math.floor(Math.random() * 10000);//10秒内随机
    // this.interval = setInterval(this._keepAlive.bind(this), (2 * 60 * 1000) + delay);
    // this._keepAlive()
  }

  getLoginState () {
    return this.model.findOne({master: true})
  }

  setLoginState (str) {
    return this.model.update({master: true}, {loginState: str}, {
      safe: true,
      upsert: false,
      setDefaultsOnInsert: false
    })
  }

  _getDescribe () {
    let pid = process.pid, ips = util.getInnerIps()
    let d = process.pid + ':' + ips
    return d
  }

  _getMyId () {
    let id = '', pid = process.pid, ips = util.getInnerIps()
    id = util.md5(this._getDescribe())
    return id
  }

  count () {
    this.logger.debug('count()')
    return this.model.count({})
  }

  isMaster () {
    this.logger.debug('isMaster')
    let model = this.model
    let self = this
    return new Promise(function (resolve, reject) {
      self.logger.test('isMaster', 'verbose')
      model.updateOne({_id: self.myId}, {
        updateAt: Date.now()
      }, {
        safe: true,
        upsert: true,
        setDefaultsOnInsert: true
      })
        .then(() => {
          return model.findOneAndUpdate({}, {
            $set: {
              master: true
            }
          }, {
            sort: {createAt: 1}
          })
          // return model.findOne({})
        })
        .then((doc) => {
          if (doc._id === self.myId) {
            self.logger.test('isMaster', 'verbose', 'true')
            resolve(true)
          } else {
            self.logger.test('isMaster', 'verbose', 'false')
            resolve(false)
          }
        })
        .catch(err => {
          reject(err)
        })
    })
  }

  deleteMySelf () {
    this.logger.debug('_deleteMySelf()')
    if (this.interval) {
      clearInterval(this.interval)
    }
    let model = this.model, self = this
    return model.remove({_id: self.myId})
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
module.exports = Cluster
