/**
 * Created by Administrator on 2017/5/18.
 * 爬取进程
 * 接收一个文件名参数
 */

if (process.argv.length === 2) {
  console.log('CrawlerApp:Miss File Path.')
  process.exit(1)
}
const path = require('path')
const fileFullName = path.resolve(process.argv[2])
const pkg = require('../package.json')

process.title = 'GL-V' + pkg.version

const {NodeVM, VMError} = require('vm2')
const Crawler = require('./crawler.js')
try {
  NodeVM.file(fileFullName, {
    console: false, // 'inherit'
    require: false,
    sandbox: {Crawler}
  })
} catch (ex) {
  if (ex instanceof VMError) {
    console.error(`\x1B[31m[vm:error] ${ex.message}\x1B[39m`)
  } else {
    const {stack} = ex
    if (stack) {
      console.error(`\x1B[31m[vm:error] ${stack}\x1B[39m`)
    } else {
      console.error(`\x1B[31m[vm:error] ${ex}\x1B[39m`)
    }
  }
  process.exit(1)
}
