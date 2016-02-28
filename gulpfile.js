/* jshint asi: true */

var gulp = require('gulp')
var level = require('level')
var LevelPromise = require('level-promise')
var forkdb = require('forkdb')
var sprom = require('sprom')
var fetch = require('github-fetch')
var transform = require('./index')
var config = require('./config.json')

var cache = forkdb(level(config.db.cache.level), { dir: config.db.cache.fork })
var lod = forkdb(level(config.db.lod.level), { dir: config.db.lod.fork })
var mappings = level(config.db.mappings.level)
LevelPromise(mappings)

var prefix = 'https://api.github.com/'
var options = { token: config.api.token }

gulp.task('fetch', function () {
  config.repos.map(function (repo) {
    var repoUrl = prefix + 'repos/' + repo.source
    fetch(repoUrl, options).then(function (data) {
      console.log('fetched: ', repoUrl)
      put(cache, data, repoUrl)
    }).catch(function (err) {
      console.log(err)
    })
    var issuesUrl = prefix + 'repos/' + repo.source + '/issues'
    fetch(issuesUrl, options).then(function (data) {
      console.log('fetched: ', issuesUrl)
      put(cache, data, issuesUrl)
    }).catch(function (err) {
      console.log(err)
    })
  })
})

gulp.task('process', function () {
  config.repos.map(function (repo) {
    var container = new transform.Resource()
    var issues
    var repoUrl = prefix + 'repos/' + repo.source
    get(cache, repoUrl).then(function (data) {
      mappings.get(data.id).catch(function (err) {
        if (err.type === 'NotFoundError') {
          var repold = transform.repo(data, repo.uriSpace)
          put(lod, repold, repold['@graph'][0].id.replace('#id', ''))
          issues = repold['@graph'][1] // FIXME
          issues.item = []
          var issuesUrl = prefix + 'repos/' + repo.source + '/issues'
          get(cache, issuesUrl).then(function (data) {
            return Promise.all(data.map(function (issue) {
              var repold = transform.issue(issue, repo.uriSpace)
              var uri = repold['@graph'][0].id.replace('#id', '') // FIXME
              put(lod, repold, uri)
              issues.item.push(uri)
            })).then(function () {
              container['@graph'].push(issues)
              put(lod, container, issues.id)
            })
          }).catch(function (err) {
            console.log(err)
          })
        }
      })
    }).catch(function (err) {
      console.log(err)
    })
  })
})

gulp.task('publish', function () {
})

function get (db, uri) {
  return sprom.arr(db.forks(uri))
    .then(function (hashes) {
      return sprom.buf(db.createReadStream(hashes[0].hash))
    }).then(function (doc) {
      // FIXME
      return JSON.parse(JSON.parse(doc.toString()))
    })
}

function put (db, doc, uri) {
  console.log('saving: ', uri)
  return sprom.arr(db.forks(uri))
    .then(function (hashes) {
      return Promise.resolve(hashes[0])
    }).then(function (prev) {
      var meta = { key: uri }
      if (prev) meta.prev = prev
      // return sprom.end(db.createWriteStream(meta).end(JSON.stringify(doc)))
      // FIXME
      var w = db.createWriteStream(meta, function (err, hash) {
        if (err) console.log(err)
        else console.log('write', hash)
      })
      w.end(JSON.stringify(doc))
    }).then(function (hash) {
      console.log('imported: ' + uri + ' as ' + hash)
    }).catch(function (err) {
      console.error(err.stack || err.message || err)
    })
}
