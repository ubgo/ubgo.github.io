// lock: fencing tokens. A holder that was paused past its lease writes with an old
// token, and the storage wrapper rejects it because a newer holder has written with a
// higher one. Source: ubgo/lock README, "3. Fencing tokens — defend against the
// GC-pause scenario". Tokens are shown as N and N+1: the README says Token() is a
// monotonic uint64 and gives no example values.
import { helpers, register, svg } from "./stepper.js"

const W = 440
const H = 280

const A = { x: 12, y: 16 }
const B = { x: 308, y: 16 }
const BOX_W = 120
const STORE = { x: 110, y: 170, w: 220, h: 74 }

// Where the write packet sits: at its sender, or at the storage edge.
const PKT_HOME_A = [A.x + 18, 112]
const PKT_HOME_B = [B.x + 18, 112]
const PKT_AT_STORE_A = [STORE.x - 4, STORE.y - 32]
const PKT_AT_STORE_B = [STORE.x + STORE.w - 80, STORE.y - 32]

function proc(k, p, name) {
  return `<rect data-k="${k}" class="xp-box xp-anim xp-shadow" x="${p.x}" y="${p.y}" width="${BOX_W}" height="62" rx="10"/>
<text x="${p.x + 12}" y="${p.y + 24}" class="xp-b">${name}</text>
<text data-k="${k}-st" x="${p.x + 12}" y="${p.y + 46}" class="xp-s xp-m">idle</text>`
}

function packet(k, label) {
  return `<g data-k="${k}" class="xp-anim"><rect data-k="${k}-r" class="xp-box xp-anim" x="0" y="0" width="84" height="24" rx="6"/><text data-k="${k}-t" x="42" y="16" text-anchor="middle" class="xp-s xp-mono">${label}</text></g>`
}

function build(stage) {
  stage.innerHTML = svg(
    W,
    H,
    `
<path data-k="w-al" class="xp-wire xp-anim" d="M${A.x + BOX_W} 40 H160"/>
<path data-k="w-bl" class="xp-wire xp-anim" d="M${B.x} 40 H280"/>
<path data-k="w-as" class="xp-wire xp-anim" d="M${A.x + 60} 78 C${A.x + 60} 140 ${STORE.x + 40} 130 ${STORE.x + 40} ${STORE.y}"/>
<path data-k="w-bs" class="xp-wire xp-anim" d="M${B.x + 60} 78 C${B.x + 60} 140 ${STORE.x + STORE.w - 40} 130 ${STORE.x + STORE.w - 40} ${STORE.y}"/>

${proc("a", A, "Process A")}
${proc("b", B, "Process B")}

<rect data-k="lock" class="xp-box xp-anim xp-shadow" x="160" y="10" width="120" height="74" rx="10"/>
<text x="220" y="30" text-anchor="middle" class="xp-s xp-m">lock</text>
<text x="220" y="48" text-anchor="middle" class="xp-s xp-mono">payment-export</text>
<text data-k="lock-st" x="220" y="66" text-anchor="middle" class="xp-s xp-b">free</text>
<rect x="172" y="74" width="96" height="4" rx="2" class="xp-fill" style="opacity:.35"/>
<rect data-k="lease" x="172" y="74" width="0" height="4" rx="2" class="xp-fill xp-anim"/>

<g data-k="tokA" class="xp-anim"><rect class="xp-box is-active" x="${A.x + 66}" y="${A.y + 70}" width="80" height="20" rx="10"/><text x="${A.x + 106}" y="${A.y + 84}" text-anchor="middle" class="xp-s xp-mono is-active">token N</text></g>
<g data-k="tokB" class="xp-anim"><rect class="xp-box is-active" x="${B.x - 26}" y="${B.y + 70}" width="80" height="20" rx="10"/><text x="${B.x + 14}" y="${B.y + 84}" text-anchor="middle" class="xp-s xp-mono is-active">token N+1</text></g>

<rect data-k="store" class="xp-box xp-anim xp-shadow" x="${STORE.x}" y="${STORE.y}" width="${STORE.w}" height="${STORE.h}" rx="10"/>
<text x="${STORE.x + 12}" y="${STORE.y + 20}" class="xp-s xp-m">storage wrapper</text>
<text x="${STORE.x + STORE.w - 12}" y="${STORE.y + 20}" text-anchor="end" class="xp-s xp-mono xp-m">today.csv</text>
<text x="${STORE.x + 12}" y="${STORE.y + 42}" class="xp-s">highest token seen</text>
<text data-k="hi" x="${STORE.x + STORE.w - 12}" y="${STORE.y + 42}" text-anchor="end" class="xp-s xp-mono xp-b">none</text>
<text x="${STORE.x + 12}" y="${STORE.y + 62}" class="xp-s">file holds</text>
<text data-k="data" x="${STORE.x + STORE.w - 12}" y="${STORE.y + 62}" text-anchor="end" class="xp-s xp-b">nothing yet</text>

${packet("pa", "write N")}
${packet("pb", "write N+1")}

<text data-k="verdict" x="220" y="268" text-anchor="middle" class="xp-s xp-b xp-anim"></text>
`,
    "Process A and B take turns holding a lock; the storage rejects A's write with an older fencing token",
  )
  return helpers(stage)
}

function apply(h, step) {
  const s = step
  // Processes
  h.text("a-st", ["holds the lock", "paused (long GC)", "paused, lease gone", "paused, lease gone", "paused, lease gone", "wakes up, writes", "wakes up, writes"][s])
  h.state("a", s === 0 ? "active" : s >= 1 && s <= 4 ? "warn" : s === 5 ? "err" : "err")
  h.state("a-st", s >= 1 && s <= 4 ? "warn" : "")
  h.text("b-st", s < 3 ? "waiting" : s === 3 ? "holds the lock" : "holds the lock")
  h.state("b", s >= 3 ? (s >= 4 && s !== 6 ? "ok" : "active") : "")
  h.dim("b", s < 3)
  h.cls("tokA", { "is-hidden": false, "is-dim": s >= 3 && s <= 4 })
  h.show("tokB", s >= 3)
  // Lock and its lease
  h.text("lock-st", s <= 1 ? "held by A" : s === 2 ? "free (TTL expired)" : "held by B")
  h.state("lock", s <= 1 ? "active" : s === 2 ? "warn" : "ok")
  h.state("lock-st", s === 2 ? "warn" : "")
  const lease = h.q("lease")
  lease.style.transitionDuration = s === 1 ? "2.6s" : ""
  lease.style.width = `${s === 0 ? 96 : s === 1 ? 14 : s === 2 ? 0 : 96}px`
  h.state("lease", s <= 1 ? "active" : s === 2 ? "warn" : "ok")
  h.state("w-al", s === 0 ? "active" : "")
  h.state("w-bl", s === 3 ? "active" : "")
  // Writes
  const aAt = s >= 5 ? PKT_AT_STORE_A : PKT_HOME_A
  const bAt = s >= 4 ? PKT_AT_STORE_B : PKT_HOME_B
  h.move("pa", aAt[0], aAt[1])
  h.move("pb", bAt[0], bAt[1])
  h.show("pa", s >= 5)
  h.show("pb", s >= 4)
  h.state("pa-r", s === 5 ? "err" : s === 6 ? "warn" : "")
  h.state("pb-r", s >= 4 ? "ok" : "")
  h.state("w-as", s === 5 ? "err" : s === 6 ? "warn" : "")
  h.state("w-bs", s === 4 ? "ok" : "")
  h.text("hi", s >= 4 ? "N+1" : "none")
  h.state("hi", s >= 4 ? "ok" : "")
  h.text("data", s < 4 ? "nothing yet" : s === 6 ? "A's stale data" : "B's data")
  h.state("data", s === 6 ? "err" : s >= 4 ? "ok" : "")
  h.state("store", s === 4 ? "ok" : s === 5 ? "ok" : s === 6 ? "err" : "")
  h.text(
    "verdict",
    ["", "", "", "", "Highest token so far: write accepted", "N < N+1: A's write is rejected", "Without fencing: B's write is lost"][s],
  )
  h.state("verdict", s === 4 ? "ok" : s === 5 ? "ok" : s === 6 ? "err" : "")
}

register("lock-fencing", { build, apply, steps: 7, preview: 5 })
