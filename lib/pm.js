/**
 * Created by Administrator on 2017/5/18.
 * 进程管理
 */
// process.env.DEBUG = "PM,-not_this";//"*,-not_this"
const debug = require('debug')('PM')
const path = require('path')
const pm2 = require('pm2')

const CRAWLER_APP = path.resolve(__dirname, 'app.js')
const CRON_APP = path.resolve(__dirname, 'cron.js')

let _getName = (file) => {
    debug('_getName', file)
    let name = path.basename(file)
        // name = name.split('.')[0];
    return name
  },
  _connect = () => {
    debug('_connect')
    return new Promise((resolve, reject) => {
      pm2.connect((err) => {
        err ? reject(err) : resolve()
      })
    })
  },
  _delete = (name) => {
    debug('_delete', name)
    return new Promise((resolve, reject) => {
      pm2.delete(name, (err) => {
        resolve()
      })
    })
  },
  _start = (config) => {
    debug('_start %o', config)
    return new Promise((resolve, reject) => {
      pm2.start(config, (err, list) => {
        if (err) {
          reject(err)
          return
        }
        let pids = []
        list.forEach((i) => {
          pids.push(i.pid)
        })
        resolve(pids.toString())
      })
    })
  },
  _stop = (name) => {
    debug('_stop', name)
    return new Promise((resolve, reject) => {
      pm2.stop(name, (err) => {
        err ? reject(err) : resolve()
      })
    })
  },
  _list = () => {
    debug('_list')
    return new Promise((resolve, reject) => {
      pm2.list((err, list) => {
        err ? reject(err) : resolve(list)
      })
    })
  }
let _startIfNotRunning = (option) => {
  debug('_startIfNotRunning %o', option)
  let name = option.name
  return new Promise((resolve, reject) => {
    let pid = false
    _list()
            .then((list) => {
              list.forEach((i) => {
                if (i.name === name && i.pm2_env.status === 'online') {
                  pid = i.pid
                }
              })
              if (pid) { // is running
                resolve(pid)
              } else {
                _delete(name)
                        .then(() => {
                          return _start(option)
                        })
                        .then((pid) => {
                          resolve(pid)
                        })
                        .catch((err) => {
                          debug('_startIfNotRunning %O', err)
                          reject(err)
                        })
              }
            })
            .catch((err) => {
              debug('_startIfNotRunning %O', err)
              reject(err)
            })
  })
}

const pm = {
  startCron: (fileFullName, instanceNum, cronString) => {
    debug('pm.startCron', fileFullName, cronString)
    let name = _getName(fileFullName)
    let cron_option = {
      name: name + '.cron',
      script: CRON_APP,
      args: [fileFullName, instanceNum, cronString],
      logDateFormat: 'YYYY-MM-DD HH:mm:ss.X Z',
      //interpreterArgs: '--harmony-async-await',
      execMode: 'fork', // “cluster” or “fork”, default fork
      watch: false,
      autorestart: false,
      mergeLogs: true,
      force: false
    }
    return new Promise((resolve, reject) => {
      if (!cronString || !fileFullName) {
        resolve()
        return
      }

      _connect()
                .then((pid) => {
                  return _startIfNotRunning(cron_option)
                })
                .then((pid) => {
                  pm2.disconnect()
                  resolve(pid)
                })
                .catch((err) => {
                  pm2.disconnect()
                  resolve(err)
                })
    })
  },
    /**
     * 启动 正在运行不重复启动 忽略异常
     * @param fileFullName 文件完整路径
     * @param instanceNum 实例数量
     * @returns {Promise} pid
     */
  start: (fileFullName, instanceNum) => {
    debug('pm.start', fileFullName, instanceNum)
    let name = _getName(fileFullName)
    let workDir = path.dirname(fileFullName)
    let execMode = 'fork'
    if (instanceNum > 1) {
      execMode = 'cluster'
    }
    let app_option = {
      name: name,
      script: CRAWLER_APP,
      args: fileFullName,
      //interpreterArgs: '--harmony-async-await',
      execMode: execMode,
      watch: false,
            // logDateFormat: "YYYY-MM-DD HH:mm:ss.X Z",
            /*            output: path.resolve(workDir, name + "_out.log"),
             error: path.resolve(workDir, name + "_err.log"),
             pid: path.resolve(workDir, name + ".pid"), */
      autorestart: false,
      mergeLogs: true,
      force: false
    }
    if (execMode === 'cluster') {
      app_option.instances = instanceNum
    }

    return new Promise((resolve, reject) => {
      _connect()
                .then((pid) => {
                  return _startIfNotRunning(app_option)
                })
                .then((pid) => {
                  pm2.disconnect()
                  resolve(pid)
                })
                .catch((err) => {
                  pm2.disconnect()
                  resolve(err)
                })
    })
  },
    /**
     * 停止 忽略异常
     * @param file 文件完整路径
     * @returns {Promise}
     */
  stop: (file) => {
    debug('pm.stop', file)
    let name = _getName(file)
    let cronName = name + '.cron'
    return new Promise((resolve, reject) => {
      _connect()
                .then(() => {
                  return _stop(name)
                })
                .then(() => {
                  return _stop(cronName)
                })
                .then(() => {
                  pm2.disconnect()
                  resolve()
                })
                .catch(err => {
                  pm2.disconnect()
                  resolve()
                })
    })
  }
}
module.exports = pm

// pm.start("d:/GitHub/godless/demo/demo.js")
// pm.stop("demo.js")
