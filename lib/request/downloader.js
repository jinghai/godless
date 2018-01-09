/**
 * Created by Administrator on 2017/6/13.
 * https://github.com/request/request
 */
const mkdirp = require('mkdirp')
const request = require('request')
const mime = require('mime')
const Path = require('path')
const fs = require('fs')
const Url = require('url')
const uuidV4 = require('uuid/v4')
const contentDisposition = require('content-disposition')
const Observable = require('../base/observable.js')

class Downloader extends Observable {
  constructor (config) {
    config = config || {}
    config.moduleName = 'Downloader'
    super(config)
  }

    /**
     *从url中识别文件名和路径
     * @param url
     * @returns {path:String,name:String,ext:String}
     */
  _parseUrltoFile (url) {
    this.logger.debug('_parseUrltoFile(url)', url)
    let uri = Url.parse(url, false, true)
    let pathName = uri.hostname + uri.pathname
    if (pathName.charAt(0) === '/') {
      pathName = pathName.substring(1)
    }
    let path = Path.dirname(pathName)
    let ext = Path.extname(uri.pathname)
    let name = Path.basename(uri.pathname, ext)
    let obj = {path: path, name: name, ext: ext}
    this.logger.debug('_parseUrltoFile(url)<--', obj)
    return obj
  }

    /**
     * 下载文件
     * options.url 网址
     * options.fileName 可选 没设置则从url路径抽取，若url中抽取的文件名无扩展名则扩展名根据mime中生成
     * @param options
     */
  download (options) {
    let self = this
    self.logger.debug('download(options)', options)
    let fileObj = this._parseUrltoFile(options.url)

    return new Promise((resolve, reject) => {
      let downloadPath = options.downloadPath || self.options.downloadPath
      if (!downloadPath) {
        let msg = 'no downloadPath config'
        self.logger.error('download(option) Error', msg)
        reject(msg)
        return
      }
      let name = self.options.name || ''
      let baseDir = Path.resolve(downloadPath, name, fileObj.path)
      mkdirp.sync(baseDir)
      let tempFileStr = Path.resolve(baseDir, uuidV4() + '.tmp')
      let tempFile = fs.createWriteStream(tempFileStr)
      let contentDispositionFileName, mimeExtName

      var j = request.jar()
      if (options.cookies) {
        options.cookies.forEach((cookie) => {
          j.setCookie(cookie, options.url)
        })
        delete options.cookies
        options.jar = j
      }

      request(options)
                .on('error', (err) => {
                  if (tempFile) tempFile.close()
                  fs.unlinkSync(tempFileStr)
                  self.logger.error('download(option) Error', err)
                  reject(err)
                })
                .on('complete', (response, body) => {
                  self.logger.debug('download(options)->contentFileName,mimeExtName', contentDispositionFileName, mimeExtName)
                  let contentDispositionExtName = ''
                  if (contentDispositionFileName) {
                    contentDispositionExtName = Path.extname(contentDispositionFileName)
                  }
                    // 从contentDisposition解析的扩展名优先
                  mimeExtName = contentDispositionExtName || mimeExtName
                  let urlFileName = fileObj.name + (fileObj.ext ? fileObj.ext : mimeExtName)
                  let name = options.fileName || urlFileName
                  let realFileStr = Path.resolve(baseDir, name)
                  if (tempFile) tempFile.close()
                  fs.renameSync(tempFileStr, realFileStr)
                  if (response.statusCode < 200 || response.statusCode > 300) { // error
                    fs.unlinkSync(realFileStr)
                    self.logger.warn('download(option) statusCode:', response.statusCode)
                    reject(response.statusCode)
                  } else {
                    resolve({ok: true, url: options.url, file: realFileStr, html: ''})
                  }
                })
                .on('response', (response) => {
                  let status = response.statusCode
                  self.logger.debug('download(options)->headers', status, response.headers)
                  if (status === 302) {
                    self.logger.warn('download(options)->headers', status, response.headers)
                  }
                  if (status >= 200 && status < 400) {
                    let str = response.headers['content-disposition']
                    if (str) {
                      let p = contentDisposition.parse(str)
                      if (p.parameters && p.parameters.filename) {
                        contentDispositionFileName = p.parameters.filename
                      }
                    }
                    let contentType = response.headers['content-type']
                    if (contentType) {
                      mimeExtName = mime.extension(contentType)
                    }
                  }
                })
                .pipe(tempFile)
    })
  }
}

module.exports = Downloader

/* var d = new Downloader({
 downloadPath:'/tmp'
 });
 d.download({
 "url": "images/loding.git",
 "cookies": ['a=b','b=c']
 })
 .then((ret)=> {
 console.log(ret);
 })
 .catch((err)=> {
 console.log(err);
 }); */
