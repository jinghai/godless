/**
 * Created by Administrator on 2017/5/18.
 * https://github.com/merencia/node-cron
 * 定时任务进程
 * 入参：文件名,实例个数,定时表达式
 */

if (process.argv.length < 4) {
  console.log('CronApp : Miss <file> <instanceNum> <cronStr>')
  process.exit(1)
}
const path = require('path')
const fileFullName = path.resolve(process.argv[2])
const instanceNum = process.argv[3]
const cronStr = process.argv[4]
const pm = require('./pm.js')

process.title = 'GL-' + cronStr

console.log('启动定时器', fileFullName, instanceNum, cronStr)

var CronJob = require('cron').CronJob
new CronJob(cronStr, function () {
  console.log('定时启动', fileFullName, instanceNum)
  pm.start(fileFullName, instanceNum)
}, null, true)

process.on('SIGINT', function () {
  console.log('定时器退出')
})
