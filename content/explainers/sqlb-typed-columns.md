---
title: "Typed columns: mistakes fail the build"
description: "In sqlb every column has a Go type, so comparing, scanning or joining it the wrong way stops go build instead of failing in production."
library: sqlb
readme_section: "Checked three times, not claimed once"
readme_anchor: checked-three-times-not-claimed-once
weight: 60
steps:
  - title: "Declare the table once"
    text: "A library declares its columns as package-level values. Col[T] is where the type comes from: Email is an sqlb.Expr[string] and CreatedAt an sqlb.Expr[time.Time]."
  - title: "A correct query builds"
    text: "Comparing the string column ID with a string, and scanning Email into a string, type checks. go build succeeds and Build renders the SQL."
  - title: "Wrong type in a comparison"
    text: "Comparing the string column Email with the number 42 does not compile. The compiler stops the build before any SQL exists."
  - title: "Wrong scan target"
    text: "Binding the string column Email to an *int does not compile either, so a scan can never write into the wrong kind of variable."
  - title: "Joining mismatched columns"
    text: "EqExpr compares two columns at their Go types. Joining the string ID to the time.Time CreatedAt does not compile."
  - title: "A Postgres clause on SQLite"
    text: "Engine clauses are typed to their dialect. pg.ForUpdate() on a SQLite statement does not compile."
  - title: "Engine expressions: caught at Build"
    text: "This is the honest limit of the type system. A pgvector expression under the SQLite dialect compiles, but Build returns ErrUnsupportedDialect naming the construct, in your process, before anything reaches a database."
  - title: "A real database checks execution"
    text: "Rendering SQL is not the same as running it. Every driver runs a shared conformance suite, and the pgx driver executes every pg construct (593 cases) against Postgres 17."
---

The compiler messages in the diagram are the real output of `go build` for those statements, built against the sqlb source, with only the `file:line:col` prefix removed.

The README's own list of what does not compile includes a string column bound to an `*int`, a time column compared with a string, a vector distance over a text column, and a sum over a non-numeric column. `examples/typecheck` in the repository holds deliberately wrong statements like these behind a build tag, and the project's gate fails if that file ever compiles.

```go
var Table = sqlb.Table{Name: "app_user", Alias: "u"}

var (
	ID        = sqlb.Col[string](Table, "id")
	Email     = sqlb.Col[string](Table, "email")
	CreatedAt = sqlb.Col[time.Time](Table, "created_at")
)
```
