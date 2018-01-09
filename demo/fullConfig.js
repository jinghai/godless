/**
 * Created by Administrator on 2017/6/30.
 */
var Crawler = require('../')

var config = {
  cron: '', // 【秒】【分】【小时】【日】【月】【周】 *所有 ?不指定 -区间 */5每5
  name: 'fullDemo',
  level: 'info', // [debug|verbose|info|warn|error]
  db: '',//存放数据的数据库名称'mongodb://192.168.2.67/crawlerNew',
  sysdb: null, // 存放集群数据的数据库名称'mongodb://192.168.2.67/_sys',
  startUrl: '',
  targetReg: null,
  helpReg: null,
  interval: 1000,
  schema: null,
  allowUpdate: true,
  userAgent: 'PC', // [PC|MB|WX|BSP-PC|BSP-M]
  randomUA: true, // UserAgent轮询
  proxy: '', // 127.0.0.1:8910
  proxyAuth: '', // username:password
  proxyType: 'http', // [http|socks5|none]
  cookies: false,
  enableJS: false,
  loadImages: false,
  needLogin: false,
  cycle: true,
  downloadPath: '',
  timeout: 15000,

  beforeStart: function () {},
  login: function () {},
  beforeRequest: function () {},
  onLoad: function () {},
  isAntiSpider: function () {},
  doFindLink: function () {},
  doStartPage: function () {},
  doHelpPage: function () {},
  doTargetPage: function () {}
}

var crawler = new Crawler(config)
crawler.start()
