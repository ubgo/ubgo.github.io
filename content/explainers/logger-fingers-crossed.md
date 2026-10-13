---
title: "Debug logs only when something breaks"
description: "FingersCrossed holds each request's debug lines back and writes them only if that request logs an error."
library: logger
readme_section: "Debug-on-error (FingersCrossed)"
readme_anchor: debug-on-error-fingerscrossed
weight: 50
steps:
  - title: "A request gets its own buffer"
    text: "The handler calls logger.FCScope(r.Context()). Every request now has its own buffer for log lines."
  - title: "A debug line is held back"
    text: "log.DebugContext(ctx, \"loaded config\") goes into the request's buffer. Nothing is written to the sink yet."
  - title: "Another debug line"
    text: "log.DebugContext(ctx, \"queried db\") joins it in the buffer. The sink is still empty."
  - title: "The request succeeds: silence"
    text: "The request finishes without an error. A successful request logs nothing below the activation level, so neither debug line is ever written."
  - title: "A second request, same lines"
    text: "The next request gets a fresh buffer and logs the same two debug lines. They wait in its buffer."
  - title: "This time an error is logged"
    text: "log.ErrorContext(ctx, \"boom\") fires inside the request."
  - title: "The error flushes the whole trail"
    text: "The first error flushes the buffer: both debug lines and the error are written. You get the full story exactly when something breaks."
---

The setup from the README:

```go
fc := logger.NewFingersCrossed(
	logger.NewWriterSink(os.Stderr, logger.NewJSONEncoder(), logger.LevelTrace),
)
log := logger.New(logger.WithTransport(logger.NewSyncTransport(fc)), logger.WithLevel(logger.LevelTrace))

func handler(w http.ResponseWriter, r *http.Request) {
	ctx := logger.FCScope(r.Context()) // one buffer per request
	log.DebugContext(ctx, "loaded config")
	log.DebugContext(ctx, "queried db")
	// if everything succeeds → nothing is emitted
	// if log.ErrorContext(ctx, "boom") fires → the two Debug lines + the error are all flushed
}
```

The README calls this the killer feature: full detail when a request fails, and quiet logs when it does not.
