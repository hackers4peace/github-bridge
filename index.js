/* jshint asi: true */

var uuid = require('node-uuid')

var Resource = function () {
  this['@context'] = 'https://w3id.org/plp/v1'
  this['@graph'] = []
}

var repo = function (data, uriSpace) {
  var uri = uriSpace + uuid.v4() + '#id'
  var doc = new Resource()

  var project = {
    id: uri,
    type: 'Project',
    name: data.name,
    description: data.description
  }
  doc['@graph'].push(project)

  var goals = {
    id: uriSpace + uuid.v4(),
    type: 'Container',
    resource: project.id,
    rel: "goal"
  }
  doc['@graph'].push(goals)

  return doc
}

var issue = function (data, uriSpace) {
  var uri = uriSpace + uuid.v4() + '#id'
  var doc = new Resource()

  var goal = {
    id: uri,
    type: 'Goal',
    name: data.title,
    content: data.body
  }
  doc['@graph'].push(goal)

  return doc
}

module.exports = {
  Resource: Resource,
  repo: repo,
  issue: issue
}
