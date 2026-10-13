// cache Remember, single-flight: 30 goroutines miss "user:42" at once, the loader runs
// exactly once and the other 29 share its result. Source: ubgo/cache README,
// "How `Remember` decides" (the 30-goroutine figure is the README's own example).
import { helpers, register, svg } from "./stepper.js"

const W = 440
const H = 280
const COLS = 5
const ROWS = 6 // 5 x 6 = the README's 30 goroutines
const GAP = 17

function dots() {
  let out = ""
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c
      const x = 34 + c * GAP
      const y = 92 + r * GAP
      out += `<circle data-k="${i === 0 ? "lead" : "rest"}" class="xp-fill xp-anim${i === 0 ? " xp-pulse" : ""}" cx="${x}" cy="${y}" r="6"/>`
    }
  }
  return out
}

function build(stage) {
  stage.innerHTML = svg(
    W,
    H,
    `
<text x="22" y="40" class="xp-l">30 goroutines</text>
<text x="22" y="58" class="xp-s xp-m xp-mono">Remember("user:42")</text>
<rect x="20" y="76" width="96" height="114" rx="10" class="xp-box xp-anim" data-k="grid"/>
${dots()}
<text data-k="status" x="22" y="216" class="xp-s xp-m">all at the same moment</text>

<path data-k="w-in" class="xp-wire xp-anim" d="M118 133 H168"/>
<path data-k="w-out" class="xp-wire xp-anim is-hidden" d="M168 147 H118"/>

<rect data-k="rem" x="168" y="96" width="112" height="84" rx="12" class="xp-box xp-anim xp-shadow"/>
<text x="224" y="128" text-anchor="middle" class="xp-mono xp-b">Remember</text>
<text data-k="rem-sub" x="224" y="150" text-anchor="middle" class="xp-s xp-m">single-flight</text>

<path data-k="w-cache" class="xp-wire xp-anim" d="M280 118 C300 118 300 72 322 72"/>
<path data-k="w-load" class="xp-wire xp-anim" d="M280 158 C300 158 300 187 322 187"/>

<rect data-k="cache" x="322" y="34" width="102" height="76" rx="10" class="xp-box xp-anim"/>
<text x="334" y="56" class="xp-s xp-m">cache</text>
<text x="334" y="77" class="xp-s xp-mono">user:42</text>
<text data-k="cache-val" x="334" y="97" class="xp-s xp-mono xp-anim">empty</text>

<rect data-k="load" x="322" y="150" width="102" height="74" rx="10" class="xp-box xp-anim"/>
<text x="334" y="172" class="xp-s xp-m">loader fn</text>
<text x="334" y="193" class="xp-s xp-mono">db lookup</text>
<text data-k="calls" x="334" y="213" class="xp-s xp-mono xp-b">calls: 0</text>

<rect x="20" y="236" width="400" height="30" rx="8" class="xp-box"/>
<text data-k="note" x="32" y="256" class="xp-s">Cache is empty. Every caller asks for the same key.</text>
`,
    "30 callers ask Remember for user:42; one loader call serves them all",
  )
  return helpers(stage)
}

// Each step sets the whole picture (see stepper.js).
function apply(h, step) {
  const s = step
  h.state("grid", s === 0 ? "active" : "")
  h.state("lead", s === 0 ? "active" : s === 1 ? "warn" : s <= 3 ? "active" : "ok")
  h.state("rest", s === 0 ? "active" : s === 1 ? "warn" : s <= 3 ? "" : "ok")
  h.cls("lead", { "is-dim": s === 5 })
  h.cls("rest", { "is-dim": s === 2 || s === 3 || s === 5 })
  h.state("w-in", s <= 2 ? "active" : s === 5 ? "active" : "")
  h.show("w-out", s === 4)
  h.state("w-out", s === 4 ? "ok" : "")
  h.state("rem", s === 2 || s === 3 ? "active" : s === 4 ? "ok" : "")
  h.text("rem-sub", s === 2 || s === 3 ? "1 call in flight" : "single-flight")
  h.state("w-cache", s === 1 ? "warn" : s === 3 ? "ok" : s === 5 ? "ok" : "")
  h.state("cache", s === 1 ? "warn" : s >= 3 ? "ok" : "")
  h.text("cache-val", s === 0 ? "empty" : s === 1 || s === 2 ? "miss" : "= value")
  h.state("cache-val", s === 1 || s === 2 ? "warn" : s >= 3 ? "ok" : "")
  h.state("w-load", s === 2 ? "active" : s === 3 ? "ok" : "")
  h.state("load", s === 2 ? "active" : "")
  h.text("calls", `calls: ${s >= 2 ? 1 : 0}`)
  h.state("calls", s >= 2 ? (s >= 4 ? "ok" : "active") : "")
  h.text(
    "status",
    ["all at the same moment", "30 misses", "1 runs fn · 29 wait", "1 runs fn · 29 wait", "30 get the same value", "a later caller"][s],
  )
  h.text(
    "note",
    [
      "Cache is empty. Every caller asks for the same key.",
      "Get returns ErrNotFound for all 30 callers.",
      "Only one loader call starts. The other 29 block.",
      "Value goes into an envelope; Set with hard TTL + jitter.",
      "One loader call, 30 results.",
      "Fresh hit: return the cached value. fn is not called.",
    ][s],
  )
}

register("cache-single-flight", { build, apply, steps: 6, preview: 2 })
