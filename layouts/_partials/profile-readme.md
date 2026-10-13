{{- $d := hugo.Data.libraries -}}
{{- $site := "https://ubgo.github.io" -}}
<!-- Generated from site/data/libraries.yaml in ubgo.github.io by `task profile`. Edit the data file there, not this file. -->

<p align="center"><img src="ubgo-icon-512.png" alt="ubgo logo: a bold lowercase u holding one amber block" width="72" height="72"></p>
<h1 align="center">ubgo</h1>
<p align="center"><strong>Focused Go libraries for production services.</strong></p>
<p align="center">Focused Go libraries, plus a few TypeScript ones, for errors, logging, caching, config, SQL, GraphQL, HTTP services, crypto and tooling.</p>
<p align="center">
  <a href="{{ $site }}"><img src="https://img.shields.io/badge/site-ubgo.github.io-0891B2" alt="Website: ubgo.github.io"></a>
  <img src="https://img.shields.io/badge/public%20libraries-{{ len $d.libraries }}-0891B2" alt="{{ len $d.libraries }} public libraries">
  <img src="https://img.shields.io/badge/language-Go%20%C2%B7%20TypeScript-0891B2" alt="Languages: Go and TypeScript">
</p>

ubgo is a set of small Go libraries (and a few TypeScript ones), with their source on GitHub, for building backend services: structured errors and logging, caching with Redis, Postgres, Memcached and in-memory backends, typed configuration and .env files, SQL building, GraphQL and ent helpers, health checks, graceful shutdown and crypto. Each library does one job and has its own repository, so you import only what you need.

- [Libraries by area](#libraries-by-area)
{{- if $d.principles }}
- [Principles](#principles)
{{- end }}
- [Install](#install)
- [FAQ](#faq)

## Libraries by area
{{ range $d.areas }}
{{- $a := . }}
### {{ .title }}

{{ range sort (where $d.libraries "area" .key) "name" -}}
- [**{{ .name }}**](https://github.com/ubgo/{{ .name }}): {{ .summary }}{{ if eq .kind "examples" }} *(examples)*{{ else if eq .kind "cli" }} *(CLI)*{{ end }}
{{ end }}
{{- end }}
{{- with $d.principles }}
## Principles

These hold for the libraries named under each point, as their own READMEs state. They are not a promise for every repo.

{{ range . -}}
- **{{ .title }}.** {{ .text }} For example: {{ range $i, $r := .repos }}{{ if $i }}, {{ end }}[{{ $r }}](https://github.com/ubgo/{{ $r }}){{ end }}.
{{ end }}
{{- end }}
## Install

Most libraries install with:

```sh
go get github.com/ubgo/<name>
```

A few use a sub-module or a different module path. Each repo's README, and its page on [{{ replace $site "https://" "" }}]({{ $site }}/libraries/), gives the exact line.

## FAQ

**Do I need to install everything?** No. Every library is its own Go module (and some split further into sub-modules), so you add only the ones you use.

**Where are the docs?** Each repository's README, plus its page on pkg.go.dev (or npm for the TypeScript ones). The [library index]({{ $site }}/libraries/) links to both.

**Where do I report a bug?** Open an issue in that library's repository.
