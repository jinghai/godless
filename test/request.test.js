/**
 * Created by yneos on 2017/4/21.
 */
let assert = require('assert')
let request = require('../lib/request/request.js')
describe('test request', function () {
  it('request.get', function (done) {
    request
            .get('https://baidu.com')
            .then(html => {
              assert.ok(html)
              done()
            })
  })
})
