{{- $d := hugo.Data.libraries -}}
{{- $site := "https://ubgo.github.io" -}}
<!-- Generated from site/data/libraries.yaml in ubgo.github.io by `task profile`. Edit the data file there, not this file. -->

<p align="center"><img src="ubgo-icon-512.png" alt="ubgo logo: a bold lowercase u holding one amber block" width="72" height="72"></p>
<h1 align="center">ubgo</h1>
<p align="center"><strong>Batteries included for Go, one module at a time.</strong></p>
<p align="center"><em>Early alpha: ubgo is still being built and is not fully production-ready yet, so libraries and APIs may change.</em></p>
<p align="center">Open-source Go libraries, plus a few TypeScript ones, for authentication, errors, logging, caching, config, SQL, GraphQL, HTTP services, crypto and tooling.</p>
<p align="center">
  <a href="{{ $site }}"><img src="https://img.shields.io/badge/site-ubgo.github.io-0891B2" alt="Website: ubgo.github.io"></a>
  <img src="https://img.shields.io/badge/public%20libraries-{{ len $d.libraries }}-0891B2" alt="{{ len $d.libraries }} public libraries">
  <img src="https://img.shields.io/badge/language-Go%20%C2%B7%20TypeScript-0891B2" alt="Languages: Go and TypeScript">{{ if eq (partial "license-summary.html" .) "Every library is open source under Apache-2.0." }}
  <img src="https://img.shields.io/badge/license-Apache--2.0-0891B2" alt="License: Apache-2.0">{{ end }}
</p>

ubgo is an ecosystem for building Go apps, in the spirit of the components Laravel ships for authentication, caching, logging and configuration. Every piece is its own Go module, so a service imports only what it uses: sign-in, sessions, two-factor, passkeys, OAuth and organizations, structured errors and logging, caching with Redis, Postgres, Memcached and in-memory backends, typed configuration and .env files, SQL building, GraphQL and ent helpers, health checks, graceful shutdown and crypto. The main libraries share one shape, a small core with adapters outside it and a shared test suite, so learning one teaches you the next.

- [Libraries by area](#libraries-by-area)
- [Volt](#volt)
{{- if $d.upcoming }}
- [Upcoming](#upcoming)
{{- end }}
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
## Volt

Volt is the layer on top of ubgo to build, release and ship Go CLIs and libraries: the `volt` tool (scaffold, CI gate, coverage, cross-platform builds, verified releases) plus importable kit modules for building the CLIs themselves.

```sh
{{ $d.volt.install }}
```

{{ range $d.volt.repos -}}
- [**{{ .name }}**](https://github.com/ubgo/{{ .name }}): {{ .summary }}
{{ end }}
{{ with $d.upcoming -}}
## Upcoming

These exist but are not public yet, so they have no links. More libraries are on the way.

{{ range . -}}
- **{{ .name }}**: {{ .summary }}
{{ end }}
{{ end -}}
{{ with $d.principles -}}
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

{{ range where $d.libraries "install" "ne" "" }}{{ if and (hasPrefix .install "go get") (hasSuffix .install "@latest") }}[{{ .name }}](https://github.com/ubgo/{{ .name }}) is not tagged yet; install the newest commit with `{{ .install }}`.
{{ end }}{{ end }}
Some are split into sub-modules or ship a CLI to `go install`. Each repo's README, and its page on [{{ replace $site "https://" "" }}]({{ $site }}/libraries/), gives the exact line.

## FAQ

**Do I need to install everything?** No. Every library is its own Go module (and some split further into sub-modules), so you add only the ones you use.

**Where are the docs?** Each repository's README, plus its page on pkg.go.dev (or npm for the TypeScript ones). The [library index]({{ $site }}/libraries/) links to both.

**What license are they under?** {{ partial "license-summary.html" . }} The LICENSE file in each repository is the source of truth.

**Where do I report a bug?** Open an issue in that library's repository.
