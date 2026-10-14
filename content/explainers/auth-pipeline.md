---
title: "One pipeline for every entry point"
description: "An auth operation is defined once and served over HTTP, GraphQL and Go. Every call runs the same steps in the same order, so no entry point can skip a check."
library: auth
readme_section: "Quick start"
readme_anchor: quick-start
weight: 5
steps:
  - title: "One operation, three ways in"
    text: "password.sign-in is defined once. That one definition is POST /auth/password/sign-in over HTTP, a mutation in GraphQL, and pw.SignIn(ctx, …) from Go."
  - title: "Rate limit by client address"
    text: "A sign-in arrives over HTTP. The first step is the rate limit by client address, so a flood costs one counter increment and nothing else."
  - title: "Origin check"
    text: "A mutation that carries a session cookie from an origin that is not the base URL or a trusted origin is refused here, before any lookup, so a cross-site request learns nothing."
  - title: "The session, resolved once"
    text: "The session is resolved once per request and shared by every operation in it."
  - title: "The requirement"
    text: "Every operation has one. Sign-in is Public; most others are SignedIn, and changing a password or an address is FreshSignIn."
  - title: "Input and the per-account limit"
    text: "The input is decoded and the per-account rate limit counted, both before any transaction, so a failed call cannot roll its own count back."
  - title: "One transaction"
    text: "A mutation opens one transaction for everything after this point. Data hooks and plugin writes all join it."
  - title: "Hooks, then the operation"
    text: "Before hooks run, then the operation, then after hooks. An after hook can still fail the call, and its effects are then dropped."
  - title: "Commit, then effects"
    text: "Only after the commit do effects reach the client: authhttp turns \"issue session\" into a Set-Cookie, or a Set-Auth-Token header for an app in bearer mode."
  - title: "A refused call stops at the first failure"
    text: "Another run: a flood of sign-ins from one address. The rate limit refuses it at step 1 with 429 auth.rate_limited and a Retry-After header, and no later step runs."
  - title: "The same steps from GraphQL and Go"
    text: "A GraphQL resolver and a Go call run the same operation through the same steps. There is no second copy for the Go API that could forget a check."
---

The quick start from the README, which the diagram follows:

```go
a, err := auth.New(
	auth.WithDB(db, sqlb.PostgresDialect{}),
	auth.WithBaseURL("https://app.example.com"),
	auth.WithPlugins(
		email.New(email.Login(), email.Recover(), email.WithMailer(mailer)),
		password.New(),
	),
)
if err != nil {
	log.Fatal(err) // a broken plugin combination fails here, not in production
}

mux.Handle("/auth/", authhttp.Handler(a, authhttp.Prefix("/auth")))
mux.Handle("/me", authhttp.Middleware(a)(authhttp.RequireUser(meHandler)))
```

The README sums the pipeline up as rate limits, the CSRF origin check, the session, hooks and one transaction. The full order of the eight steps is in the auth guide [Plugins and the pipeline](https://github.com/ubgo/auth/blob/main/docs/concepts/plugins-and-pipeline.md#step-3--know-the-pipeline-order), and the refusal is described in [Rate limits](https://github.com/ubgo/auth/blob/main/docs/concepts/rate-limits.md).
