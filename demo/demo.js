/**
 * Created by yneos on 2017/4/26.
 */

//sysdb: 'mongodb://192.168.2.56/_sys',
//db: 'mongodb://192.168.2.56/test',

var Crawler = require('../')

var config = {
  name: 'wikiart.org.艺术品', // 必填
  level: 'info', // debug|verbose|info|warn|error
  sysdb: 'mongodb://192.168.2.56/_sys',
  db: 'mongodb://192.168.2.56/test',
  startUrl: 'https://www.wikiart.org/',
  schema: {
    name: {type: String, key: true},
    title: String,
    author: String,
    authorUrl: String,
    originalTitle: String,
    date: String,
    style: String,
    period: String, // 时期
    genre: String, // 材质，载体
    media: String,
    dimensions: String, // 尺寸
    location: String,
    referencesUrl: String,
    largeImgUrl: String,
    smallImgUrl: String
  },
  userAgent: 'PC',
  allowUpdate: true,
  //loadImages: false,
  downloadPath: '/data',
  doFindLink: function (url, $, html) {
    return false
  },
  doStartPage: function (url, $, html) {
    var links = [];
    var self = this;
    $('.group.active>.column>ins>a').each(function () {
      let link = $(this).attr('href')
      if(/alphabet/.test(link)){
        links.push({
          url: link,
          isHelp: true,
          actions: [{
            wait: 1000
          },{
            scrollToBottom: {}
          }]
        })
      }
    })
    self.logger.log('发现目录', links.length);
    this.SyncUtil.push(links)
  },
  doHelpPage: function (url, $, html) {
    var self = this;
    function isPersion(url) {
      var reg = /^https:\/\/www\.wikiart\.org\/en\/?/g
      if (reg.test(url)) {
        var temp = url.split('https://www.wikiart.org/en/')[1]
        var is = /\//.test(temp)
        return !is
      } else {
        return false
      }
    }

    var persons=[];
    $('.artists-list>li>a[href]').each(function () {
      var link = $(this).attr('href')
      //寻找作者链接，并增加作品url
      if(isPersion(link)){
        persons.push({
          url: link+'/all-works',
          isHelp: true,
          actions: [{
            wait: 1000
          },{
            scrollToBottom: {}
          },{
            clickMore: {selector: '#btn-more'}
          }]
        })
      }
    })
    self.logger.log('发现人员', persons.length);
    self.SyncUtil.push(persons)

    //所有作品中寻找目标
    if(/all-works$/.test(url)){
      let targes = []
      $('.st-Masonry-container>.st-masonry-tile>a.massonary-title-mobile').each(function () {
        let link = $(this).attr('href')
        targes.push({
          url: link,
          isTarget: true
        })
      })
      self.logger.log('发现作品', targes.length);
      self.SyncUtil.push(targes)
    }

  },
  doTargetPage: function (url, $, html) {
    var name, title, author, authorUrl, originalTitle, date, style, period, genre, media, dimensions, location,
      referencesUrl, largeImgUrl, smallImgUrl;
    name = url.split('/')// https://www.wikiart.org/en/aaron-shikler
    name = name[name.length - 1]
    title = $('div.info-line.painting-header>h1').text()
    authorUrl = $('div[itemprop=creator]>span>a').attr('href')
    if (authorUrl) {
      author = authorUrl.split('/')
      author = author[author.length - 1]
    }
    $('div.info>div.info-line').each(function (i, elem) {
      var str = $(this).text().replace(/\s/g, '')
      if (/Original Title:/.test(str)) originalTitle = str.split('Original Title:')[1]
      if (/Date:/.test(str)) date = str.split('Date:')[1]
      if (/Style:/.test(str)) style = str.split('Style:')[1]
      if (/Period:/.test(str)) period = str.split('Period:')[1]
      if (/Genre:/.test(str)) genre = str.split('Genre:')[1]
      if (/Media:/.test(str)) media = str.split('Media:')[1]
      if (/Dimensions:/.test(str)) dimensions = str.split('Dimensions:')[1]
      if (/Location:/.test(str)) location = str.split('Location:')[1]
      if (/References:/.test(str)) referencesUrl = $(this).find('a[href]').attr('href')
    })

    largeImgUrl = $('div.favourites-menu-anchor>a').attr('href')
    smallImgUrl = $('div.copyright-message-overlay-wrapper>img').attr('src')
    this.SyncUtil.push([{url: smallImgUrl, method: 'download'}, {url: largeImgUrl, method: 'download'}], url)
    var data = {
      name: name,
      title: title,
      author: author,
      authorUrl: authorUrl,
      originalTitle: originalTitle,
      date: date,
      style: style,
      period: period,
      genre: genre,
      media: media,
      dimensions: dimensions,
      location: location,
      referencesUrl: referencesUrl,
      largeImgUrl: largeImgUrl,
      smallImgUrl: smallImgUrl
    }
    this.logger.log(data);
    return data
  }

}

var crawler = new Crawler(config)
crawler.start()
