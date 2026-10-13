---
title: "Cache stampede protection with Remember"
description: "When many goroutines miss the same key at once, Remember runs your loader one time and hands the result to all of them."
library: cache
readme_section: "How `Remember` decides"
readme_anchor: how-remember-decides
weight: 10
steps:
  - title: "30 callers ask for one key"
    text: "The cache is empty. 30 goroutines call Remember for user:42 at the same moment, each with the same loader function."
  - title: "Every caller misses"
    text: "Get finds nothing, so each caller sees a miss (ErrNotFound). Without protection, all 30 would now run the loader and hit the database."
  - title: "Only one runs the loader"
    text: "The miss goes into a single-flight loader. One goroutine runs your function; the other 29 block and wait for its answer."
  - title: "The value is stored"
    text: "The loader returns. Remember wraps the value in a small envelope and stores it with Set, using the hard TTL plus jitter."
  - title: "All 30 share one result"
    text: "The 29 waiting goroutines get the same value. The loader ran exactly once for 30 callers."
  - title: "Later calls are cache hits"
    text: "A caller that arrives while the entry is still fresh gets the cached value straight away. The loader is not called."
---

The README describes it in one line: *30 goroutines that all miss `user:42` at once run the loader **exactly once**; the other 29 block and share the result.*

```go
p, err := cache.Remember(ctx, c, "product:99", 10*time.Minute,
    func(ctx context.Context) (Product, error) { return db.Product(ctx, 99) },
)
```

Add `WithJitter` so a batch of keys written together do not all expire in the same instant, and `WithRefreshAhead` so a hot key is refreshed in the background before it expires. The [freshness explainer](../cache-freshness/) shows those windows.
