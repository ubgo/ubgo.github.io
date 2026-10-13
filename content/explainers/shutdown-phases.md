---
title: "Phased graceful shutdown"
description: "When the stop signal arrives, shutdown runs your cleanup hooks phase by phase, in parallel inside each phase, within a fixed time budget."
library: shutdown
readme_section: "Strategy: which phase does each thing go in?"
readme_anchor: strategy-which-phase-does-each-thing-go-in
weight: 30
steps:
  - title: "The service is running"
    text: "Hooks are registered in phases, as in the README quick start: the HTTP server, NATS, the database, Redis and OpenTelemetry. Listen blocks until SIGTERM or SIGINT."
  - title: "SIGTERM arrives"
    text: "The budget clock starts (WithBudget(30s) in the quick start). Phases run lowest value first. PhasePreShutdown (-100) has no hooks in this example, so it has nothing to do."
  - title: "Stop accepting new requests"
    text: "PhaseStopAccepting (0): the HTTP server stops taking new connections. The HTTP contrib registers here so the database and other clients stay open for the requests still in flight."
  - title: "Drain in-flight work"
    text: "PhaseDrainTraffic (100): NATS drains. A phase starts only after the one before it has finished."
  - title: "Close clients, in parallel"
    text: "PhaseFlushQueues (200) is empty here. In PhaseCloseClients (300) the db and redis hooks run at the same time, because hooks inside one phase run in parallel."
  - title: "Flush logs and traces last"
    text: "PhaseFlushLogs (400): OpenTelemetry flushes last, so the spans from the earlier phases actually leave the process."
  - title: "Done: Listen returns"
    text: "Every phase has run. Listen returns errors.Join of any hook errors and you decide how to exit, or let WithExitOnComplete(0, 1) exit for you."
  - title: "If a hook hangs: the watchdog"
    text: "Another run: redis never returns. After the budget plus the grace period (1 second by default), the watchdog calls os.Exit with the failure code (1 with WithExitOnComplete(0, 1)) and logs the stuck hook's name."
  - title: "A second SIGTERM forces exit"
    text: "If the operator sends SIGTERM again while shutdown is still running, the manager calls os.Exit(130) at once. This is the escape hatch when something hangs."
---

The quick start from the README, which the diagram follows:

```go
mgr := shutdown.New(shutdown.WithBudget(30 * time.Second))

srv := &http.Server{Addr: ":8080", Handler: yourMux()}
_ = shutdownnethttp.Register(mgr, srv)

_ = mgr.Register("db",    closeFn(db.Close),  shutdown.WithPhase(shutdown.PhaseCloseClients))
_ = mgr.Register("redis", closeFn(rdb.Close), shutdown.WithPhase(shutdown.PhaseCloseClients))
_ = mgr.Register("nats",  closeFn(nc.Drain),  shutdown.WithPhase(shutdown.PhaseDrainTraffic))
_ = mgr.Register("otel",  tp.Shutdown,        shutdown.WithPhase(shutdown.PhaseFlushLogs))

if err := mgr.Listen(context.Background()); err != nil {
    log.Fatal(err)
}
```

Phases are plain `int` values, so you can pass any number to `WithPhase` to order a hook between the predefined phases. Set the budget a few seconds shorter than Kubernetes' `terminationGracePeriodSeconds` so the service exits cleanly before it is killed.
