/**
 * Created by yneos on 2017/4/18.
 * https://github.com/skratchdot/random-useragent
 */
const randomUseragent = require('random-useragent')

const keys = {
  'BSP-PC': true,
  'BSP-M': true,
  'PC': true,
  'MB': true,
  'WX': true
}

const defaultCount = 100
const BaiduspiderPC = 'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html）'
const BaiduspiderMobile = 'Mozilla/5.0 (Linux;u;Android 4.2.2;zh-cn;) AppleWebKit/534.46 (KHTML,like Gecko) Version/5.1 Mobile Safari/10600.6.3 (compatible; Baiduspider/2.0; '
const WXAndroid = 'Mozilla/5.0 (Linux; U; Android 2.3.6; zh-cn; GT-S5660 Build/GINGERBREAD) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1 MicroMessenger/4.5.255'
const WXIphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 5_1 like Mac OS X) AppleWebKit/534.46 (KHTML, like Gecko) Mobile/9B176 MicroMessenger/4.3.2'

function isPc (ua) {
  return ua.deviceType !== 'mobile' && (
            ua.osName === 'Windows' ||
            ua.osName === 'Linux' ||
            ua.osName === 'Mac OS'
        ) &&
        ((
         ua.browserName === 'Chrome' &&
         parseFloat(ua.browserVersion) > 50
         ) || (
         ua.browserName === 'Firefox' &&
         parseFloat(ua.browserVersion) > 50
         ) || (
         ua.browserName === 'Safari' &&
         parseFloat(ua.browserVersion) > 6
         ) || (
            ua.browserName === 'IE' &&
            parseFloat(ua.browserVersion) > 9
        ) || (
            ua.browserName === 'Edge' &&
            parseFloat(ua.browserVersion) > 10
        ))
}

function isMobile (ua) {
  return ua.deviceType === 'mobile' &&
        (
            ua.osName === 'iOS' ||
            ua.osName === 'Android' ||
            ua.osName === 'Windows Phone OS'
        ) &&
        ((
            ua.browserName === 'Chrome' &&
            parseFloat(ua.browserVersion) > 50
        ) || (
            ua.browserName === 'Firefox' &&
            parseFloat(ua.browserVersion) > 50
        ) || (
            ua.browserName === 'Android Browser' &&
            parseFloat(ua.browserVersion) > 4
        ) || (
            ua.browserName === 'Mobile Safari' &&
            parseFloat(ua.browserVersion) > 6
        ) || (
            ua.browserName === 'IEMobile' &&
            parseFloat(ua.browserVersion) > 9
        ) || (
            ua.browserName === 'Edge' &&
            parseFloat(ua.browserVersion) > 10
        ))
}

function checkInput (key) {
  if (typeof key === 'string' && keys[key.toUpperCase()] === true) {
    return key.toUpperCase()
  } else {
    throw new Error('参数', key, '不在允许范围内')
  }
}

function getOne (key) {
  key = checkInput(key)
  switch (key) {
    case 'BSP-PC':
      {
        return BaiduspiderPC
      }
    case 'BSP-M':
      {
        return BaiduspiderMobile
      }
    case 'WX':
      {
        return WXAndroid
      }
    case 'PC':
      {
        return randomUseragent.getRandom(isPc)
      }
    case 'MB':
      {
        return randomUseragent.getRandom(isMobile)
      }
  }
}

function getMany (key, count) {
  key = checkInput(key)
  count = count || defaultCount
  switch (key) {
    case 'BSP-PC':
      {
        return [BaiduspiderPC]
      }
    case 'BSP-M':
      {
        return [BaiduspiderMobile]
      }
    case 'WX':
      {
        return [WXAndroid, WXIphone]
      }
    case 'PC':
      {
        let agents = []
        for (let i = 0; i < count; i++) {
          agents.push(getOne(key))
        }
        return agents
      }
    case 'MB':
      {
        let agents = []
        for (let i = 0; i < count; i++) {
          agents.push(getOne(key))
        }
        return agents
      }
  }
}
module.exports = {
  getOne: getOne,
  getMany: getMany,
  isInKey: function (key) {
    if (typeof key === 'string' && keys[key.toUpperCase()] === true) {
      return true
    }
    return false
  }
}
