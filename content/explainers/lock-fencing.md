---
title: "Fencing tokens stop stale writes"
description: "A process that paused while holding a lock can wake up and write old data; a fencing token lets the storage refuse that write."
library: lock
readme_section: "3. Fencing tokens — defend against the GC-pause scenario"
readme_anchor: 3-fencing-tokens--defend-against-the-gc-pause-scenario
weight: 40
steps:
  - title: "A takes the lock"
    text: "Process A acquires payment-export and reads its fencing token with holder.Token(). Tokens are monotonic, so each new holder gets a higher one. Call A's token N."
  - title: "A is paused"
    text: "A long garbage-collection pause freezes A. It still believes it holds the lock, but its lease keeps running out."
  - title: "The lease expires"
    text: "The lock's TTL runs out and the lock is reclaimed automatically. A does not know this yet."
  - title: "B takes the lock"
    text: "Process B acquires the same lock and gets a higher token, N+1."
  - title: "B writes with its token"
    text: "B sends its write together with token N+1. The storage wrapper records N+1 as the highest token it has seen and accepts the write."
  - title: "A wakes up and is rejected"
    text: "A resumes and tries to write its stale data with token N. The wrapper rejects any write whose token is lower than the highest it has seen, so A's write fails and B's data stays."
  - title: "Without fencing"
    text: "If the storage did not check tokens, A's late write would overwrite B's fresh one, even though A no longer held the lock."
---

The code from the README. The storage side (here `s3.PutWithFence`) is your own small wrapper that remembers the highest token and refuses anything lower:

```go
holder, _ := locks.Acquire(ctx, "payment-export")
defer holder.Release()
fence := holder.Token()  // monotonic uint64

if err := s3.PutWithFence(ctx, "payments/today.csv", data, fence); err != nil {
    return err
}
```

This is the defence from Martin Kleppmann's "How to do distributed locking". The lock alone cannot protect you here, because the paused process does not know its lease has ended; the token check at the storage is what catches it.
