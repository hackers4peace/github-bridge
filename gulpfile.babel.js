import gulp from 'gulp'
import uuid from 'uuid'
import level from 'level'
import LevelPromise from 'level-promise'
import forkdb from 'forkdb'
import fdbp from 'forkdb-promise'
import fetch from 'github-fetch'
import Storage from 'o-storage-forkdb'
import Dataset from 'o-utils-dataset'
import SimpleRDF from 'simplerdf'
import JsonldParser from 'rdf-parser-jsonld'

const config = require('./config.json')
const parser = new JsonldParser()
const cache = forkdb(level(config.db.cache.level), { dir: config.db.cache.fork })
const mappings = level(config.db.mappings.level)
LevelPromise(mappings)
const dataset = new Dataset(new Storage(config.db.lod))
const prefix = 'https://api.github.com/'
const options = { token: config.api.token }

const context = {
  '@vocab': 'http://schema.org/',
  'id': '@id',
  'type': '@type',
  'ldp': 'http://www.w3.org/ns/ldp#',
  'hydra': 'http://www.w3.org/ns/hydra/core#',
  'flow': 'http://www.w3.org/2005/01/wf/flow#',
  'foaf': 'http://xmlns.com/foaf/0.1/',
  'resource': 'ldp:membershipResource',
  'icr': 'ldp:insertedContentRelation',
  'rel': 'ldp:hasMemberRelation',
  'rev': 'ldp:isMemberOfRelation',
  'primaryTopic': 'foaf:primaryTopic',
  'contains': 'ldp:contains'
}

function transformRepo (data, uri) {
  let doc = {
    '@context': context,
    '@graph': []
  }

  let resource = {
    id: uri,
    type: [ 'ldp:Resource', 'hydra:Resource' ]
  }
  doc['@graph'].push(resource)

  let creation = {
    id: resource.id + '#creation',
    type: [ 'CreativeWork', 'SoftwareSourceCode' ],
    name: data.name,
    description: data.description
  }
  doc['@graph'].push(creation)

  resource.primaryTopic = creation.id
  return parser.parse(doc)
}

function transformIssue (data, uri) {
  let doc = {
    '@context': context,
    '@graph': []
  }

  let resource = {
    id: uri,
    type: [ 'ldp:Resource', 'hydra:Resource' ]
  }
  doc['@graph'].push(resource)

  let task = {
    id: resource.id + '#task',
    type: 'flow:Task',
    name: data.title,
    description: data.body
  }
  doc['@graph'].push(task)

  resource.primaryTopic = task.id
  return parser.parse(doc)
}

// TODO add done() by using Promise.all
gulp.task('fetch', () => {
  config.repos.map((repo) => {
    let repoUrl = prefix + 'repos/' + repo.source
    fetch(repoUrl, options).then((data) => {
      console.log('fetched: ', repoUrl)
      fdbp.put(cache, repoUrl, data)
    }).catch((err) => {
      console.log('fetch repo', err)
    })
    let issuesUrl = prefix + 'repos/' + repo.source + '/issues'
    fetch(issuesUrl, options).then((data) => {
      console.log('fetched: ', issuesUrl)
      fdbp.put(cache, issuesUrl, data)
    }).catch((err) => {
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
    .then((resourceUri) => {
      // TODO implement update
      return Promise.resolve(resourceUri)
    }, (err) => {
      if (err.type === 'NotFoundError') {
        let resourceUri = uriSpace + uuid.v4()
        return transformFunction(gh, resourceUri)
          .then((graph) => {
            return Promise.all([
              dataset.createResource(resourceUri, graph),
              mappings.put(gh.id, resourceUri)
            ])
          }).then(() => {
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
  let creationUrl
  let tasksUri
  let link = {
    'http://www.w3.org/ns/ldp#hasMemberRelation': 'http://www.w3.org/2005/01/wf/flow#task'
  }
  return fdbp.get(cache, ghRepoUrl(repo))
    .then((ghRepoStr) => {
      let json = JSON.parse(ghRepoStr)
      return gh2lod(json, repo.uriSpace, transformRepo)
    }).then((url) => {
      creationUrl = url
      return dataset.getLinkedContainerUri(creationUrl, link)
    }).then((containerUri) => {
      if (containerUri) {
        return Promise.resolve(containerUri)
      } else {
        containerUri = repo.uriSpace + uuid.v4()
        return dataset.createLinkedContainer(containerUri, creationUrl, link)
      }
    }).then((containerUri) => {
      tasksUri = containerUri
      return processIssues(repo)
    }).then((memberUris) => {
      let tasks = SimpleRDF(context, tasksUri)
      tasks.contains = memberUris
      return dataset.appendToResource(tasksUri, tasks.graph())
    })
}

function processIssues (repo) {
  return fdbp.get(cache, ghIssuesUrl(repo))
    .then((string) => {
      let ghIssues = JSON.parse(string)
      return Promise.all(ghIssues.map((ghIssue) => {
        return gh2lod(ghIssue, repo.uriSpace, transformIssue)
      }))
    })
}

gulp.task('process', (done) => {
  Promise.all(config.repos.map(processRepo))
    .then((hashes) => {
      console.log('processed ' + config.repos.length + ' repos')
      done()
    }).catch((err) => {
      console.log(err)
      done()
    })
})

gulp.task('publish', () => {
  console.log('TODO')
})
