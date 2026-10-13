---
title: "Refresh-ahead and stale values in Remember"
description: "Follow one cache entry through its life and see what Remember returns, and what it refreshes in the background, at each point."
library: cache
readme_section: "Remember and all its options"
readme_anchor: remember-and-all-its-options
weight: 20
steps:
  - title: "The first call loads and stores"
    text: "The README example uses a 10 minute TTL. On a miss the loader runs, and the entry is stored with a backend TTL of 12 minutes: the soft TTL plus the widest stale window (2 minutes)."
  - title: "Fresh: a plain cache hit"
    text: "Before refresh-ahead starts, a call just returns the cached value. Nothing else happens."
  - title: "Refresh-ahead: refresh before expiry"
    text: "WithRefreshAhead(0.8) means: once 80% of the TTL has passed (8 minutes here), refresh in the background and return the still-valid value at once. A hot key never expires under load."
  - title: "Stale-while-revalidate"
    text: "After the 10 minute expiry, WithStaleWhileRevalidate(30s) keeps serving the stale value for 30 seconds while one background load refreshes it."
  - title: "Past that window, the loader runs"
    text: "After the stale-while-revalidate window, the call goes to the single-flight loader like a miss. If the loader works, the caller gets the new value."
  - title: "Stale-if-error: availability first"
    text: "If that loader call fails, WithStaleIfError(2m) returns the stale value instead of the error, as long as it is within 2 minutes past expiry. This trades staleness for availability."
  - title: "After 12 minutes the entry is gone"
    text: "The backend dropped the entry at its 12 minute TTL. A call now is a plain miss, and if the loader fails, the caller gets the error."
---

The options from the README, all on one call:

```go
p, err := cache.Remember(ctx, c, "product:99", 10*time.Minute,
    func(ctx context.Context) (Product, error) { return db.Product(ctx, 99) },
    cache.WithRefreshAhead(0.8),
    cache.WithStaleWhileRevalidate(30*time.Second),
    cache.WithStaleIfError(2*time.Minute),
    cache.WithNegativeTTL(15*time.Second),
    cache.WithJitter(0.1),
)
```

`Remember` stores values inside a small JSON envelope (born, soft expiry, missing) so the staleness data survives any value codec. The diagram leaves out `WithNegativeTTL`, which caches a loader's `ErrNotFound` for a while, and `WithJitter`, which adds ±10% random noise to the stored TTL so keys written together do not all expire at once.
