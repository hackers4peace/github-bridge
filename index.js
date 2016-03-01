var JsonldParser = require('rdf-parser-jsonld')
var parser = new JsonldParser()

var context = {
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
var Resource = function () {
  this['@context'] = context
  this['@graph'] = []
}

var repo = function (data, uri) {
  var doc = new Resource()

  var resource = {
    id: uri,
    type: [ 'ldp:Resource', 'hydra:Resource' ]
  }
  doc['@graph'].push(resource)

  var creation = {
    id: resource.id + '#creation',
    type: [ 'CreativeWork', 'SoftwareSourceCode' ],
    name: data.name,
    description: data.description
  }
  doc['@graph'].push(creation)

  resource.primaryTopic = creation.id

  return parser.parse(doc)
}

var issue = function (data, uri) {
  var doc = new Resource()

  var resource = {
    id: uri,
    type: [ 'ldp:Resource', 'hydra:Resource' ]
  }
  doc['@graph'].push(resource)

  var task = {
    id: resource.id + '#task',
    type: 'flow:Task',
    name: data.title,
    description: data.body
  }
  doc['@graph'].push(task)

  resource.primaryTopic = task.id

  return parser.parse(doc)
}

module.exports = {
  Resource: Resource,
  context: context,
  repo: repo,
  issue: issue
}
