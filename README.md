# o-bridge-github

## features

* [x] fetch data from github and cache it in forkdb
* [x] generate URIs for all resources
* [x] store mappings between generated URIs and github internal IDs (github urls change!)
* [ ] publish derived resources to a pod

## dependencies

### o-*
* o-api-client
* o-cli-service

### common
* [github-fetch](https://github.com/hackers4peace/github-fetch)
* level
 * level-promise
* forkdb
 * sprom (promises wrapper)

## notes

### github id

github allows renaming accounts and repositories so URLs may change!!!
having github **id** allows to find current url

#### user, orga, repo

http://stackoverflow.com/a/30579888

* https://api.github.com/user/:id
* https://api.github.com/repositories/:id
* https://api.github.com/organizations/:id

#### issue

use *number* and append to repository url

`:repo_url/issues/:number`
