/**
 * Created by yneos on 2017/5/12.
 */

const Schema = require('mongoose').Schema
const Observable = require('../base/observable.js')
const util = require('../util/util.js')

class State extends Observable {
  constructor (options) {
    options = options || {}
    options.moduleName = 'State'
    super(options)
    this.db = require('../base/db.js')(options.sysdb || options.db, options)
    let self = this

    let schema = new Schema({
      _id: {type: String, default: self.options.name},
      state: String, // [运行｜停止｜完成]
      createAt: {type: Date, default: Date.now},
      queueCount: {type: Number, default: 0},
      queueSpeed: {type: Number, default: 0}, // 对列处理速度(个/分钟)
      dataCount: {type: Number, default: 0},
      dataSpeed: {type: Number, default: 0},  // 抽取数据速度(个/分钟)
      percent: {type: Number, default: 0},    // 进度
      startAt: Date,
      stopAt: Date,
      completeAt: Date,
      recentUsed: {type: String, default: ''},    // startAt用时[本次用时]
      totalUsed: {type: String, default: ''}, // createAt用时[周期用时]
      cycleNum: {type: Number, default: 0},  // 运行周期数
      instanceNum: {type: Number, default: 0} // 实例数

    }, {
      strict: true,
      versionKey: false,
      safe: true
    })
    let mName = '_state_'
    this.model = this.db.model(mName, schema, mName)
  }

  start () {
    this.logger.debug('start()')
    let self = this
    return self.get()
            .then(doc => { // 上次已完成的重新计时
              if (doc && doc.state === '完成') {
                let cycleNum = doc.cycleNum + 1
                return self._update({
                  createAt: Date.now(),
                  state: '继续运行',
                  startAt: Date.now(),
                  cycleNum: cycleNum
                })
              } else {
                return self._update({
                  state: '运行',
                  startAt: Date.now()
                })
              }
            })
  }

  stop () {
    this.logger.debug('start()')
    return this._update({
      state: '停止',
      stopAt: Date.now()
    })
  }

  complete () {
    this.logger.debug('complete()')
    return this._update({
      state: '完成',
      completeAt: Date.now()
    })
  }

  _update (data) {
    this.logger.debug('update(data)')
    let self = this
    return this.model.update({_id: self.options.name}, data, {
      safe: true,
      upsert: true,
      setDefaultsOnInsert: true
    })
  }

  get () {
    let self = this
    this.logger.debug('get()')
    return this.model.findOne({_id: self.options.name})
  }

    /**
     * 统计
     * @param startAt 本次开始时间
     * @param queueCount 队列总数
     * @param queueFinishedCount 队列总的完成数
     * @param queueCountSinceStart  本次开始完成的队列数量
     * @param dataCount 数据总数
     * @param dataCountSinceStart   本次开始完成的数据量
     * @returns {*}
     */
  statistics (createAt, startAt, queueCount, queueFinishedCount, queueCountSinceStart, dataCount, dataCountSinceStart, instanceNum) {
    this.logger.debug('statistics()', startAt, queueCount, queueFinishedCount, queueCountSinceStart, dataCount, dataCountSinceStart)
    let self = this
    let queueSpeed = 0, dataSpeed = 0, percent = 0
    let createTimestamp = createAt.getTime()
    let startTimestamp = startAt.getTime()

    let nowTimestamp = (new Date()).getTime()
    let used = (nowTimestamp - startTimestamp)// 分钟
    queueSpeed = queueCountSinceStart / used// 毫秒
    queueSpeed = Math.round(queueSpeed * 1000 * 60)// 分钟
    dataSpeed = dataCountSinceStart / used// Math.round
    dataSpeed = Math.round(dataSpeed * 1000 * 60)

    let recentUsed = util.dateDiff(nowTimestamp - startTimestamp)
    let totalUsed = util.dateDiff(nowTimestamp - createTimestamp)

    if (queueCount) {
      percent = queueFinishedCount / queueCount
      percent = percent.toFixed(2) * 100
    }
    let doc = {
      queueCount: queueCount,
      dataCount: dataCount,
      queueSpeed: queueSpeed,
      dataSpeed: dataSpeed,
      percent: percent,
      recentUsed: recentUsed,
      totalUsed: totalUsed,
      instanceNum: instanceNum
    }
    this.logger.debug('statistics()<--', doc)
    return self._update(doc)
  }

  close () {
    this.logger.debug('close')
    return this.db.close()
  }
}
module.exports = State
