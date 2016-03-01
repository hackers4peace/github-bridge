var gulp = require('gulp')
var uuid = require('node-uuid')
var level = require('level')
var LevelPromise = require('level-promise')
var forkdb = require('forkdb')
var fdbp = require('forkdb-promise')
var fetch = require('github-fetch')
var Storage = require('o-storage-forkdb').default
var Dataset = require('o-utils-dataset').default
var SimpleRDF = require('simplerdf')
var transform = require('./index')
var config = require('./config.json')

var cache = forkdb(level(config.db.cache.level), { dir: config.db.cache.fork })
var mappings = level(config.db.mappings.level)
LevelPromise(mappings)
var dataset = new Dataset(new Storage(config.db.lod))

var prefix = 'https://api.github.com/'
var options = { token: config.api.token }

// TODO add done() by using Promise.all
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

function gh2lod (gh, uriSpace, transformFunction) {
  return mappings.get(gh.id)
    .then(function (resourceUri) {
      // TODO implement update
      return Promise.resolve(resourceUri)
    }, function (err) {
      if (err.type === 'NotFoundError') {
        var resourceUri = uriSpace + uuid.v4()
        return transformFunction(gh, resourceUri)
          .then(function (graph) {
            return Promise.all([
              dataset.createResource(resourceUri, graph),
              mappings.put(gh.id, resourceUri)
            ])
          }).then(function () {
            return Promise.resolve(resourceUri)
          })
      } else {
        return Promise.reject(err)
      }
    })
}

/**
 * 1. get github json from cache
 * 2. update or create creation
 * 3. get or create tasks container
 * 4. update or create issues
 * 5. update tasks container (contains)
 */
function processRepo (repo) {
  var creationUrl
  var tasksUri
  var link = {
    'http://www.w3.org/ns/ldp#hasMemberRelation': 'http://www.w3.org/2005/01/wf/flow#task'
  }
  return fdbp.get(cache, ghRepoUrl(repo))
    .then(function (ghRepoStr) {
      var json = JSON.parse(ghRepoStr)
      return gh2lod(json, repo.uriSpace, transform.repo)
    }).then(function (url) {
      creationUrl = url
      return dataset.getLinkedContainerUri(creationUrl, link)
    }).then(function (containerUri) {
      if (containerUri) {
        return Promise.resolve(containerUri)
      } else {
        containerUri = repo.uriSpace + uuid.v4()
        return dataset.createLinkedContainer(containerUri, creationUrl, link)
      }
    }).then(function (containerUri) {
      tasksUri = containerUri
      return processIssues(repo)
    }).then(function (memberUris) {
      var tasks = SimpleRDF(transform.context, tasksUri)
      tasks.contains = memberUris
      return dataset.appendToResource(tasksUri, tasks.graph())
    })
}

function processIssues (repo) {
  return fdbp.get(cache, ghIssuesUrl(repo))
    .then(function (string) {
      var ghIssues = JSON.parse(string)
      return Promise.all(ghIssues.map(function (ghIssue) {
        return gh2lod(ghIssue, repo.uriSpace, transform.issue)
      }))
    })
}

gulp.task('process', function (done) {
  Promise.all(config.repos.map(processRepo))
    .then(function (hashes) {
      console.log('processed ' + config.repos.length + ' repos')
      done()
    }).catch(function (err) {
      console.log(err)
      done()
    })
})

gulp.task('publish', function () {
  console.log('TODO')
})
