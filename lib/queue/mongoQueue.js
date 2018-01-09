/**
 * Created by yneos on 2017/5/5.
 */
const Schema = require('mongoose').Schema
const Queue = require('./queue.js')
const crypto = require('crypto')
const async = require('async')
const util = require('../util/util.js')

const queueSchema = new Schema(require('./queueSchema.js'), {
  strict: true,
  versionKey: false,
  safe: true
    /* _id:String */
    /* _id: false,
     autoIndex: false */
})

function getlockedBy () {
  let ips = util.getInnerIps()
  return ips + ' ==> pid:' + process.pid
}

class MongoQueue extends Queue {
  constructor (options) {
    options = options || {}
    options.moduleName = 'Queue'
    super(options)
    this.db = require('../base/db.js')(options.sysdb || options.db, options)
    let mName = options.name + '.queues'
    this.model = this.db.model(mName, queueSchema, mName)
    this.saveQueue = async.queue(this._save.bind(this), 5)
    this.lockTimeout = 5 * 60 * 1000// 锁定超时时间
  }

  _getKey (queue) {
    this.logger.debug('_getKey', queue)
    if (!queue.data || !queue.data.url) throw new Error('queue has no data or data.url field')
    let url = queue.data.url
    let method = queue.data.method || 'GET'
    let dataString = ''
    if (queue.data.data) {
      if (queue.data.data instanceof String) {
        dataString = queue.data.data
      } else {
        dataString = JSON.stringify(queue.data.data)
      }
    }
    let actionStr = ''
    if (queue.data.actions) {
      actionStr = JSON.stringify(queue.data.actions)
    }
    let keyString = url + method + dataString + actionStr
    let md5 = crypto.createHash('md5')
    md5.update(keyString)
    let key = md5.digest('hex')// 32 characters
        // console.log(keyString,key)
    return key
  }

  _save (queue, callback) {
    this.logger.debug('_save', queue)
    this._push(queue)
            .then((doc) => {
              callback(null, doc)
            })
            .catch(err => {
              callback(err)
            })
  }

  _push (queue) {
    this.logger.debug('_push', JSON.stringify(queue))
    let model = this.model, self = this
    let _id = queue._id
    return new Promise(function (resolve, reject) {
            // 判重
      model.findOne({_id: _id})
                .then(doc => {
                  if (doc) {
                    resolve(doc)
                  } else {
                        // 保存
                    new model(queue)
                            .save(queue)
                            .then(doc => {
                              resolve(doc)
                            })
                            .catch(err => {
                              reject(err)
                            })
                  }
                })
                .catch(err => {
                  reject(err)
                })
    })
  }

    // 单次去重
  _data2Queue (datas, priority) {
    this.logger.debug('_data2Queue', datas)
    let result = [], obj = {}, self = this
    datas.forEach((data) => {
      obj[self._getKey({data: data})] = data
    })
    for (let key in obj) {
      let q = {
        _id: key,
        data: obj[key]
      }
      if (priority) q.priority = priority
      result.push(q)
    }
    return result
  }

  push (datas, priority) {
    this.logger.debug('push', JSON.stringify(datas), priority)
    if (!(datas instanceof Array)) {
      datas = [datas]
    }
    let saveQueue = this.saveQueue
    let self = this
    let queues = this._data2Queue(datas, priority)
    return new Promise((resolve, reject) => {
      if (queues.length == 0) {
        resolve()
        return
      }
      self.logger.verbose('push', datas.length, queues.length)
      self.logger.test('push', 'verbose', 'num:' + queues.length)
      saveQueue.drain = function () {
        self.logger.test('push', 'verbose', 'num:' + queues.length)
        resolve()
      }
      queues.forEach(queue => {
        saveQueue.push(queue, (err, queue) => {
          if (err) self.logger.warn(err, queue)
        }
                )
      })
    })
  }

  _unLockTimeout () {
    this.logger.debug('_unLockTimeout')
    let self = this, model = this.model
    return new Promise(function (resolve, reject) {
      self.logger.test('_unLockTimeout')
      var now = new Date()
      var t1 = now.getTime()
      var t2 = t1 - (self.lockTimeout)// debug 30*1000 hour2
      var time = new Date(t2)
      model.updateMany({
        state: 'locked',
        lockedAt: {'$lt': time}
      }, {
        state: 'todo',
        lockedAt: null,
        lockedBy: null
      })
                .then(() => {
                  self.logger.test('_unLockTimeout')
                  resolve()
                })
                .catch(err => {
                  reject(err)
                })
    })
  }

  pop () {
    this.logger.debug('pop')
    let model = this.model
    let self = this
    return new Promise(function (resolve, reject) {
      self.logger.test('pop', 'verbose')
      let result = null
      model.findOneAndUpdate({
        state: 'todo'
      }, {
        $set: {
          state: 'locked',
          lockedAt: Date.now(),
          lockedBy: getlockedBy()
        }
      }, {
        sort: {priority: 1}
      })
                .then(doc => {
                  result = doc
                  return self._unLockTimeout()
                })
                .then(() => {
                  self.logger.test('pop', 'verbose')
                  resolve(result)
                })
                .catch(err => {
                  reject(err)
                })
    })
  }

  finish (queue) {
    this.logger.debug('finish', queue)
    let model = this.model, self = this
    return new Promise(function (resolve, reject) {
      if (queue.success) {
        queue.state = 'finish'
      } else {
        queue.failCount++

        if (queue.failCount < 3) { // 重试3次
          queue.state = 'todo'
        }
        if (queue.failCount == 3) { // 重试3次降级一次
          queue.state = 'todo'
          queue.priority = 2
        }
        if (queue.failCount > 3) { // 失败不再重试
          queue.state = 'finish'
        }
      }
      queue.finishAt = Date.now()
      self.logger.test('finish', 'verbose', 'success:' + queue.success)
      model.update({_id: queue._id}, queue, {safe: true, upsert: false, setDefaultsOnInsert: false})
                .then(doc => {
                  self.logger.test('finish', 'verbose', 'success:' + queue.success)
                  resolve(doc)
                })
                .catch(err => {
                  reject(err)
                })
    })
  }

  success (queue) {
    this.logger.debug('success', queue)
    queue.success = true
    return this.finish(queue)
  }

  failed (queue) {
    this.logger.debug('failed', queue)
    queue.success = false
    return this.finish(queue)
  }

  isEmpty () {
    this.logger.debug('isEmpty')
    let model = this.model, self = this
    return new Promise(function (resolve, reject) {
      self.logger.test('isEmpty')
      model.count({})
                .then(num => {
                  self.logger.test('isEmpty')
                  num > 0 ? resolve(false) : resolve(true)
                })
                .catch(err => {
                  reject(err)
                })
    })
  }

  isAllFinish () {
    this.logger.debug('isAllFinish')
    let model = this.model, self = this
    return new Promise(function (resolve, reject) {
      self.logger.test('isAllFinish')
      let total = 0
      model.count({})
                .then(num => {
                  total = num
                  return model.count({state: 'finish'})
                })
                .then(num => {
                  self.logger.test('isAllFinish')
                  total === num ? resolve(true) : resolve(false)
                })
                .catch(err => {
                  reject(err)
                })
    })
  }

  clear () {
    this.logger.debug('clear')
    let model = this.model, self = this
    return model.remove({})
  }

  countFinish () {
    this.logger.debug('countFinish()')
    return this.model.count({state: 'finish'})
  }

  countSince (sinceFrom) {
    this.logger.debug('countSince(sinceFrom)', sinceFrom)
    return this.model.count({state: 'finish', finishAt: {'$gte': sinceFrom}})
  }

  count () {
    this.logger.debug('count()')
    return this.model.count({})
  }

  close () {
    this.logger.debug('close')
    return this.db.close()
  }
}

module.exports = MongoQueue

/* let q = new MongoQueue({
 db: "mongodb://192.168.2.56/test",
 name: "test",
 moduleName: 'MongoQueue'
 });
 let qqq = null;
 q.push([
 {url: 'http://www.1.com'},
 {url: 'http://www.2.com'},
 {url: 'http://www.3.com'},

 ])
 .then(doc=> {
 console.log("push ok");
 })
 .catch(err=> {
 console.error(err)
 }) */
/*
 let q = new MongoQueue({
 db: "mongodb://192.168.2.56/test",
 name: "test",
 moduleName: 'MongoQueue'
 });
 let qqq = null;
 q.push({data: {url: 'http://www.baidu.com'}})
 .then(doc=> {
 console.log("push:" + doc);
 return q.pop()
 })
 .then(doc=> {
 console.log("pop:" + doc);
 doc.success = true;
 return q.finish(doc)
 })
 .then(doc=> {
 console.log("finish:" + doc);
 return q.isEmpty()
 })
 .then(doc=> {
 console.log("isEmpty:" + doc);
 return q.isAllFinish()
 })
 .then(doc=> {
 console.log("isAllFinish:" + doc);
 return q.clear()
 })
 .then(doc=> {
 console.log("clear:");
 return q.close()
 })
 .then(doc=> {
 console.log("close:");
 })
 .catch(err=> {
 console.error(err)
 })
 */
