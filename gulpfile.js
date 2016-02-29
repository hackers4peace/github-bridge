var gulp = require('gulp')
var level = require('level')
var LevelPromise = require('level-promise')
var forkdb = require('forkdb')
var fdbp = require('forkdb-promise')
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
      fdbp.put(cache, repoUrl, data)
    }).catch(function (err) {
      console.log('fetch repo', err)
    })
    var issuesUrl = prefix + 'repos/' + repo.source + '/issues'
    fetch(issuesUrl, options).then(function (data) {
      console.log('fetched: ', issuesUrl)
      fdbp.put(cache, issuesUrl, data)
    }).catch(function (err) {
      console.log('fetch issues', err)
    })
  })
})

function ghRepoUrl (repo) {
  return prefix + 'repos/' + repo.source
}

function ghIssuesUrl (repo) {
  return prefix + 'repos/' + repo.source + '/issues'
}

function processRepo (repo) {
  var ghRepo
  var repold
  return fdbp.get(cache, ghRepoUrl(repo)).then(function (string) {
    ghRepo = JSON.parse(string)
    return mappings.get(ghRepo.id)
  }).then(function (url) {
      // TODO
  }, function (err) {
    if (err.type === 'NotFoundError') {
      repold = transform.repo(ghRepo, repo.uriSpace)
      var repoUri = repold['@graph'][0].id.replace('#id', '')
      return fdbp.put(lod, repoUri, JSON.stringify(repold))
    } else {
      return Promise.reject(err)
    }
  }).then(function () {
    return processIssues(repo)
  }).then(function (containerMembers) {
    var container = new transform.Resource()
    var tasks = repold['@graph'][1] // FIXME
    tasks['ldp:memeber'] = containerMembers
    container['@graph'].push(tasks)
    return fdbp.put(lod, tasks.id, JSON.stringify(container))
  })
}

function processIssues (repo) {
  var containerMembers = []
  return fdbp.get(cache, ghIssuesUrl(repo))
    .then(function (string) {
      var ghIssues = JSON.parse(string)
      return Promise.all(ghIssues.map(function (ghIssue) {
        var taskld = transform.task(ghIssue, repo.uriSpace)
        var taskUri = taskld['@graph'][0].id // FIXME
        containerMembers.push(taskUri)
        var resourceUri = taskUri.replace('#id', '') // FIXME
        return fdbp.put(lod, resourceUri, JSON.stringify(taskld))
      }))
    }).then(function (hashes) {
      return Promise.resolve(containerMembers)
    })
}

gulp.task('process', function (done) {
  Promise.all(config.repos.map(processRepo))
    .then(function (hashes) {
      console.log(hashes)
      done()
    }).catch(function (err) {
      console.log(err)
      done()
    })
})

gulp.task('publish', function () {
})
