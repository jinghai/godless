/**
 * Created by yneos on 2017/5/4.
 */
const crypto = require('crypto')
const Schema = require('mongoose').Schema
const async = require('async')
const Observable = require('../base/observable.js')
const util = require('../util/util.js')

class Persist extends Observable {
  constructor (options) {
    options = options || {}
    options.moduleName = 'Persist'
    super(options)
    this.db = require('../base/db.js')(options.db, options)
    this.keys = this._getFieldNamesFromSchema('key', options.schema)
    this.schema = this._initSchema(options.schema)
    this.model = this.db.model(options.name, this.schema, options.name)
    this.allowUpdate = options.allowUpdate
    this.mergeFields = this._getFieldNamesFromSchema('merge', options.schema)
    this.saveQueue = async.queue(this._save.bind(this), 5)
  }

  _getFieldNamesFromSchema (field, schema) {
    this.logger.debug('_getFieldNamesFromSchema', field, schema)
    let fields = []
    for (let prop in schema) {
      let obj = schema[prop]
      if (obj[field]) {
        fields.push(prop)
      }
    }
    if (fields.length === 0) {
      fields.push('_url')
    }
    return fields
  }

  _initSchema (schema) {
    this.logger.debug('_initSchema', schema)
    let defaultSchema = {
      _id: {type: String},
      _url: {type: String},
      _createAt: {type: Date, default: Date.now},
      _updateAt: {type: Date}
    }
    schema = Object.assign({}, schema, defaultSchema)
    let s = new Schema(schema, {
      strict: true,
      versionKey: false,
      safe: false
    })
    return s
  }

  _hasKeys (data) {
    this.logger.debug('_hasKeys', data)
    for (let index in this.keys) {
      let key = this.keys[index]
      for (let k in data) {
        if (key === k) {
          return true
        }
      }
    }
    return false
  }

  _getKey (data) {
    this.logger.debug('_getKey', data)
    let keyString = ''
    this.keys.forEach((key) => {
      keyString += data[key]
    })
    let md5 = crypto.createHash('md5')
    md5.update(keyString)
    let key = md5.digest('hex')// 32 characters
    return key
  }

  _save (data, callback) {
    this.logger.debug('_save', data)
    let self = this
    if (!this._hasKeys(data)) {
      callback('there is no keys in data:', data)
      return
    }
    let key = this._getKey(data)
    data._id = key
    this.model
            .findOne({_id: key})
            .then(doc => {
              if (!doc) { // 保存
                new self.model(data).save()
                        .then(doc => {
                          self.logger.debug('已保存：', data)
                          callback()
                        })
                        .catch(err => {
                          callback(err)
                        })
                return
              }
              if (doc && self.allowUpdate) { // 更新
                self.logger.debug('更新前', doc._doc)
                let oldData = Object.assign({}, doc._doc)
                if (self.mergeFields && self.mergeFields instanceof Array) {
                  self.mergeFields.forEach(f => {
                            // 合并String和Array字段
                    data[f] = util.mergeField(oldData[f], data[f])
                  })
                }
                    // 更新其它字段
                util.copyIfExist(oldData, data)
                util.removeEmpty(oldData)
                oldData._updateAt = Date.now()
                self.logger.debug('准备更新：', oldData)
                self.model.update({_id: oldData._id}, oldData, {
                  safe: false,
                  upsert: false,
                  setDefaultsOnInsert: true
                })
                        .then((doc) => {
                          self.logger.debug('更新后', doc)
                          callback()
                        })
                        .catch(err => {
                          callback(err)
                        })
                return
              }
              self.logger.debug('已存在：', doc._doc)
              callback()
            })
            .catch(err => {
              callback(err)
            })
  }

    // 去重
  _double (datas) {
    this.logger.debug('_double', datas)
    let result = [], obj = {}, self = this
    datas.forEach((data) => {
      data = util.removeEmpty(data)
      obj[self._getKey(data)] = data
    })
    for (let key in obj) {
      let o = obj[key]
      result.push(o)
    }
    return result
  }

  save (datas) {
    this.logger.debug('save', datas)
    let saveQueue = this.saveQueue
    let self = this
    if (!(datas instanceof Array)) {
      datas = [datas]
    }
    datas = this._double(datas)
    return new Promise((resolve, reject) => {
      if (datas.length == 0) {
        resolve()
        return
      }
      self.logger.test('save', 'verbose', 'num:' + datas.length)
      saveQueue.drain = function () {
        self.logger.test('save', 'verbose', 'num:' + datas.length)
        resolve()
      }
      datas.forEach(data => {
        saveQueue.push(data, (err, data) => {
          if (err) self.logger.warn(err, data)
        }
                )
      })
    })
  }

  count () {
    this.logger.debug('count()')
    return this.model.count({})
  }

  countSince (sinceFrom) {
    this.logger.debug('countSince(sinceFrom)', sinceFrom)
    return this.model.count({_updateAt: {'$gte': sinceFrom}})
  }

  close () {
    this.logger.debug('close')
    return this.db.close()
  }
}

module.exports = Persist

/* let p = new Persist({
 db: "mongodb://192.168.2.56/test",
 name: "test",
 schema: {f1:String,f2:String,f3:Array},
 keys:['f1'],
 allowUpdate:false,
 mergeFields:['f2','f3']
 });
 p.save([{f1:'1-1',f2:'1-2',f3:[1]}, {f1:'2-1',f2:'2-2',f3:[2]}, {f1:'3-1',f2:'3-2',f3:[2]}])
 .then(()=> {
 return p.save([{f1:'1-1',f2:'2-2',f3:[2]}, {f1:'2-1',f2:'2-2',f3:[2]}, {f1:'3-1',f2:'3-2',f3:[2]}])
 })
 .then(()=> {
 return p.save([{f1:'1-1',f2:'3-2',f3:[3]}, {f1:'2-1',f2:'2-2',f3:[2]}, {f1:'3-1',f2:'3-2',f3:[2]}])
 }) */
