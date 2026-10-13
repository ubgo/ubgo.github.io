// cache Remember, freshness windows: refresh-ahead, stale-while-revalidate and
// stale-if-error on one entry's timeline. Source: ubgo/cache README, "Remember and all
// its options" (the option values are the README's own example: TTL 10 min,
// WithRefreshAhead(0.8), WithStaleWhileRevalidate(30s), WithStaleIfError(2 min)) and the
// "How `Remember` decides" flowchart for what happens in each window.
import { helpers, register, svg } from "./stepper.js"

const W = 440
const H = 280
const X0 = 30
const PX_PER_MIN = 30 // 12 minutes (soft TTL + the widest stale window) across 360px
const x = (min) => X0 + min * PX_PER_MIN
const BAR_Y = 82
const BAR_H = 26

// Where the "call" marker sits on each step, in minutes. Only the zone matters; the
// diagram labels zones, never these exact times.
const CALL_AT = [0, 4, 9, 10.25, 11.2, 11.2, 12.6]

const zone = (k, from, to, cls) =>
  `<rect data-k="${k}" class="xp-box xp-anim ${cls}" x="${x(from)}" y="${BAR_Y}" width="${x(to) - x(from)}" height="${BAR_H}"/>`

function chip(k, cx, label, w) {
  return `<g data-k="${k}" class="xp-anim"><rect data-k="${k}-r" class="xp-box xp-anim" x="${cx}" y="18" width="${w}" height="24" rx="12"/><text x="${cx + w / 2}" y="34" text-anchor="middle" class="xp-s">${label}</text></g>`
}

function build(stage) {
  stage.innerHTML = svg(
    W,
    H,
    `
${chip("c-ttl", 14, "TTL 10 min", 80)}
${chip("c-ra", 100, "refresh-ahead 0.8", 120)}
${chip("c-swr", 226, "SWR 30s", 66)}
${chip("c-sie", 298, "stale-if-error 2m", 128)}

<text x="${(x(0) + x(8)) / 2}" y="74" text-anchor="middle" class="xp-s xp-m" data-k="l-fresh">fresh</text>
<text x="${(x(8) + x(10)) / 2 - 4}" y="74" text-anchor="middle" class="xp-s xp-m" data-k="l-ra">refresh ahead</text>
<text x="${x(10.25) + 18}" y="58" text-anchor="middle" class="xp-s xp-m" data-k="l-swr">SWR</text>
<path d="M${x(10.25)} 62 V${BAR_Y}" class="xp-wire" style="stroke-width:1"/>

<g>
${zone("z-fresh", 0, 8, "")}
${zone("z-ra", 8, 10, "")}
${zone("z-swr", 10, 10.5, "")}
${zone("z-sie", 10.5, 12, "")}
<rect data-k="z-gone" class="xp-box xp-anim" x="${x(12)}" y="${BAR_Y}" width="34" height="${BAR_H}" style="stroke-dasharray:3 3"/>
</g>
<text x="${x(11.25)}" y="${BAR_Y + 17}" text-anchor="middle" class="xp-s xp-m" data-k="l-sie">loader</text>
<text x="${x(12) + 17}" y="${BAR_Y + 17}" text-anchor="middle" class="xp-s xp-m">gone</text>

<g class="xp-s xp-m xp-mono">
<text x="${x(0)}" y="142" text-anchor="middle" class="xp-s xp-m xp-mono">0</text>
<text x="${x(8)}" y="142" text-anchor="middle" class="xp-s xp-m xp-mono">8m</text>
<text x="${x(10)}" y="142" text-anchor="middle" class="xp-s xp-m xp-mono">10m</text>
<text x="${x(12)}" y="142" text-anchor="middle" class="xp-s xp-m xp-mono">12m</text>
</g>

<path data-k="b-sie" class="xp-wire xp-anim" d="M${x(10)} 152 v6 H${x(12)} v-6"/>
<text data-k="t-sie" x="${x(12)}" y="174" text-anchor="end" class="xp-s xp-m xp-anim">stale value kept for errors</text>
<text x="${x(0)}" y="174" class="xp-s xp-m">backend TTL = 10m + 2m = 12m</text>

<g data-k="call" class="xp-anim">
  <path d="M0 ${BAR_Y - 5} V${BAR_Y + BAR_H + 10}" style="stroke:var(--xp-text);stroke-width:2"/>
  <circle cx="0" cy="${BAR_Y + BAR_H + 12}" r="5.5" style="fill:var(--xp-text)"/>
</g>

<rect data-k="r-caller" x="14" y="188" width="200" height="78" rx="10" class="xp-box xp-anim"/>
<text x="26" y="209" class="xp-s xp-m">The caller gets</text>
<text data-k="v-caller" x="26" y="234" class="xp-b">the loaded value</text>
<text data-k="v-caller2" x="26" y="254" class="xp-s xp-m">loader ran (miss)</text>

<rect data-k="r-bg" x="226" y="188" width="200" height="78" rx="10" class="xp-box xp-anim"/>
<text x="238" y="209" class="xp-s xp-m">In the background</text>
<text data-k="v-bg" x="238" y="234" class="xp-b">nothing</text>
<text data-k="v-bg2" x="238" y="254" class="xp-s xp-m">entry stored</text>
`,
    "Timeline of one cache entry: fresh, refresh-ahead, stale-while-revalidate and stale-if-error windows",
  )
  const h = helpers(stage)
  return h
}

// Per step: which zone the call lands in, what the caller gets, what runs behind it.
const STEPS = [
  { zone: "", caller: ["the loaded value", "miss: the loader ran"], bg: ["nothing", "entry stored, 12m backend TTL"], c: "ok", b: "", chips: ["c-ttl"] },
  { zone: "z-fresh", caller: ["the cached value", "fresh hit, no loader"], bg: ["nothing", ""], c: "ok", b: "", chips: ["c-ttl"] },
  { zone: "z-ra", caller: ["the cached value", "returned at once"], bg: ["refresh starts", "a hot key never expires"], c: "ok", b: "active", chips: ["c-ra"] },
  { zone: "z-swr", caller: ["the stale value", "served right away"], bg: ["one load refreshes", "stale-while-revalidate"], c: "warn", b: "active", chips: ["c-swr"] },
  { zone: "z-sie", caller: ["the new value", "loader ran and worked"], bg: ["nothing", ""], c: "ok", b: "", chips: [] },
  { zone: "z-sie", caller: ["the stale value", "loader failed, stale is kept"], bg: ["nothing", "stale-if-error window"], c: "warn", b: "", chips: ["c-sie"] },
  { zone: "z-gone", caller: ["the error", "nothing stale is left"], bg: ["nothing", "entry already dropped"], c: "err", b: "", chips: [] },
]

function apply(h, step) {
  const s = STEPS[step]
  h.move("call", x(CALL_AT[step]), 0)
  // Zones keep their color; the one the call lands in stays bright, the rest fade.
  const zoneState = { "z-fresh": "ok", "z-ra": "active", "z-swr": "warn", "z-sie": step === 5 ? "warn" : "", "z-gone": "err" }
  for (const z of Object.keys(zoneState)) {
    h.state(z, zoneState[z])
    h.dim(z, step !== 0 && s.zone !== z)
  }
  h.state("l-sie", "")
  for (const c of ["c-ttl", "c-ra", "c-swr", "c-sie"]) h.state(`${c}-r`, s.chips.includes(c) ? "active" : "")
  h.state("b-sie", step === 5 ? "warn" : "")
  h.state("t-sie", step === 5 ? "warn" : "")
  h.text("v-caller", s.caller[0])
  h.text("v-caller2", s.caller[1])
  h.state("v-caller", s.c)
  h.state("r-caller", s.c)
  h.text("v-bg", s.bg[0])
  h.text("v-bg2", s.bg[1])
  h.state("v-bg", s.b)
  h.state("r-bg", s.b)
}

register("cache-freshness", { build, apply, steps: STEPS.length, preview: 3 })
