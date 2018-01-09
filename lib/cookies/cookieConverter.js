/**
 * Created by Administrator on 2017/6/10.
 * 负责phantom和request的cookie值转换
 */

module.exports = {
    // Request需要"key1=value"这样的字符串
    // phantom中expiry转为13时间戳后转换为时间字符串存放于expires，此步骤暂时可以不做
  phantomCookes2Request: (list) => {
    let ret = []
    list.forEach((obj) => {
      let str = obj.name + '=' + obj.value
      ret.push(ret)
    })
    return ret
  },
    // PhantomCooke对象中使用expiry存放10位的时间戳，
    // 需要把request中expires: '2037-12-31T23:55:55.000Z',转成10位时间戳存放于expiry属性
  requestCookes2Phantom: (list) => {
    let ret = []
    list.forEach((obj) => {
      if (obj.expires) {
        let date = new Date(obj.expires)
        let timestamp = date.getTime()
        timestamp = Number(timestamp.toString().substring(0, 10))// 13位转10位(即去除毫秒,*1000即可转回13位)
        obj.expiry = timestamp
      }
      ret.push(obj)
    })
    return ret
  }
}
