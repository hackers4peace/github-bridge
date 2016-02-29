var uuid = require('node-uuid')

var Resource = function () {
  this['@context'] = {
    '@vocab': 'http://schema.org/',
    'id': '@id',
    'type': '@type',
    'ldp': 'http://www.w3.org/ns/ldp#',
    'flow': 'http://www.w3.org/2005/01/wf/flow#',
    'resource': 'ldp:membershipResource',
    'rel': 'ldp:hasMemberRelation',
    'rev': 'ldp:isMemberOfRelation'
  }
  this['@graph'] = []
}

var repo = function (data, uriSpace) {
  var uri = uriSpace + uuid.v4() + '#id'
  var doc = new Resource()

  var sourceCode = {
    id: uri,
    type: [ 'CreativeWork', 'SoftwareSourceCode' ],
    name: data.name,
    description: data.description
  }
  doc['@graph'].push(sourceCode)

  var tasks = {
    id: uriSpace + uuid.v4(),
    type: 'ldp:IndirectContainer',
    resource: sourceCode.id,
    rel: 'flow:task'
  }
  doc['@graph'].push(tasks)

  return doc
}

var task = function (data, uriSpace) {
  var uri = uriSpace + uuid.v4() + '#id'
  var doc = new Resource()

  var task = {
    id: uri,
    type: 'flow:Task',
    name: data.title,
    description: data.body
  }
  doc['@graph'].push(task)

  return doc
}

module.exports = {
  Resource: Resource,
  repo: repo,
  task: task
}
