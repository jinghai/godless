/**
 * Created by Administrator on 2017/6/30.
 */

var Crawler = require('../')

var config = {
  name: 'miniDemo',
  db: 'mongodb://192.168.2.56/test'
}

var crawler = new Crawler(config)
crawler.start()
