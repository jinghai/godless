/**
 * Created by yneos on 2017/5/4.
 */

const Observable = require('../base/observable.js')

class Queue extends Observable {
  constructor (config) {
    super(config)
  }

  push (queue) {
  }

  pop () {
  }

  finish (queue) {
  }

  success (queue) {
  }

  failed (queue) {
  }

  isEmpty () {
  }

  isAllFinish () {
  }

  clear () {
  }

  close () {
  }
}

module.exports = Queue
