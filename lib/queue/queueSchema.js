/**
 * Created by yneos on 2017/5/5.
 */

module.exports = {
    // key:{type:String,index:true},
  _id: {type: String},
  data: {type: Object},
  state: {type: String, default: 'todo', index: true}, // [todo,locked,finish]
  success: {type: Boolean, default: false, index: true}, // 任务执行成功
  priority: {type: Number, default: 0, index: true}, // [-1,0,1]
  failCount: {type: Number, default: 0},
  createAt: {type: Date, default: Date.now},
  lockedAt: {type: Date, index: true, index: true}, // 60秒回收
  finishAt: {type: Date},
  lockedBy: {type: String}// IP+PID
}
