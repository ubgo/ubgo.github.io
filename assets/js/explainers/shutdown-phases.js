// shutdown: phased graceful shutdown. Phases run lowest value first, hooks inside one
// phase run in parallel, the whole run is bounded by WithBudget, a watchdog hard-exits
// after budget plus grace, and a second SIGTERM exits at once with 130.
// Source: ubgo/shutdown README, "Strategy: which phase does each thing go in?" (the
// phase table), "Quick start" (the hooks and the 30s budget), "Watchdog" (1s default
// grace) and "Exit codes" (second signal -> os.Exit(130)).
import { helpers, register, svg } from "./stepper.js"

const W = 440
const H = 290
const PHASES = [
  ["PhasePreShutdown", -100, []],
  ["PhaseStopAccepting", 0, ["http"]],
  ["PhaseDrainTraffic", 100, ["nats"]],
  ["PhaseFlushQueues", 200, []],
  ["PhaseCloseClients", 300, ["db", "redis"]],
  ["PhaseFlushLogs", 400, ["otel"]],
  ["PhasePostShutdown", 500, []],
]
const ROW0 = 66
const ROW_H = 31
const PILL_X = [196, 274]
const PILL_W = 70
const BAR_X = 108
const BAR_W = 196
const GRACE_W = 24

function rows() {
  let out = ""
  PHASES.forEach(([name, val, hooks], i) => {
    const y = ROW0 + i * ROW_H
    out += `<g data-k="row${i}" class="xp-anim">
<rect data-k="rowbg${i}" class="xp-box xp-anim" x="10" y="${y}" width="420" height="${ROW_H - 5}" rx="7" style="stroke-opacity:.0"/>
<text x="20" y="${y + 17}" class="xp-s xp-mono">${name}</text>
<text x="184" y="${y + 17}" text-anchor="end" class="xp-s xp-m xp-mono">${val}</text>`
    if (!hooks.length) out += `<text x="${PILL_X[0] + 8}" y="${y + 17}" class="xp-s xp-m">no hooks</text>`
    hooks.forEach((hk, j) => {
      const x = PILL_X[j]
      out += `<rect class="xp-box" x="${x}" y="${y + 4}" width="${PILL_W}" height="${ROW_H - 13}" rx="9"/>
<rect data-k="fill-${hk}" class="xp-fill xp-anim" x="${x}" y="${y + 4}" width="0" height="${ROW_H - 13}" rx="9" style="opacity:.28"/>
<text x="${x + PILL_W / 2}" y="${y + 17}" text-anchor="middle" class="xp-s xp-mono">${hk}</text>`
    })
    out += `<text data-k="st${i}" x="420" y="${y + 17}" text-anchor="end" class="xp-s xp-m xp-anim">waiting</text></g>`
  })
  return out
}

function build(stage) {
  stage.innerHTML = svg(
    W,
    H,
    `
<rect data-k="sig" class="xp-box xp-anim" x="10" y="12" width="88" height="40" rx="9"/>
<text x="54" y="29" text-anchor="middle" class="xp-s xp-m">signal</text>
<text data-k="sig-t" x="54" y="45" text-anchor="middle" class="xp-s xp-mono xp-b">none yet</text>

<text x="${BAR_X}" y="26" class="xp-s xp-m">WithBudget(30s)</text>
<text x="${BAR_X + BAR_W + GRACE_W}" y="26" text-anchor="end" class="xp-s xp-m">+1s grace</text>
<rect class="xp-box" x="${BAR_X}" y="34" width="${BAR_W}" height="10" rx="5"/>
<rect class="xp-box" x="${BAR_X + BAR_W + 2}" y="34" width="${GRACE_W - 2}" height="10" rx="5" style="stroke-dasharray:2 2"/>
<rect data-k="budget" class="xp-fill xp-anim" x="${BAR_X}" y="34" width="0" height="10" rx="5"/>

<rect data-k="exit" class="xp-box xp-anim" x="${BAR_X + BAR_W + GRACE_W + 8}" y="12" width="${430 - (BAR_X + BAR_W + GRACE_W + 8)}" height="40" rx="9"/>
<text x="${(BAR_X + BAR_W + GRACE_W + 8 + 430) / 2}" y="29" text-anchor="middle" class="xp-s xp-m">result</text>
<text data-k="exit-t" x="${(BAR_X + BAR_W + GRACE_W + 8 + 430) / 2}" y="45" text-anchor="middle" class="xp-s xp-mono xp-b">-</text>
${rows()}
`,
    "Seven shutdown phases run in order; hooks in the same phase run in parallel",
  )
  return helpers(stage)
}

// Hook progress per step: 0 = not started, "run" = running, 1 = done, "stuck" = hung.
const HOOKS = ["http", "nats", "db", "redis", "otel"]
const STEPS = [
  { phase: -1, hooks: {}, budget: 0, sig: ["none yet", ""], exit: ["-", ""] },
  { phase: 0, hooks: {}, budget: 0.04, sig: ["SIGTERM", "active"], exit: ["-", ""] },
  { phase: 1, hooks: { http: "run" }, budget: 0.18, sig: ["SIGTERM", "active"], exit: ["-", ""] },
  { phase: 2, hooks: { http: 1, nats: "run" }, budget: 0.36, sig: ["SIGTERM", "active"], exit: ["-", ""] },
  { phase: 4, hooks: { http: 1, nats: 1, db: "run", redis: "run" }, budget: 0.55, sig: ["SIGTERM", "active"], exit: ["-", ""] },
  { phase: 5, hooks: { http: 1, nats: 1, db: 1, redis: 1, otel: "run" }, budget: 0.7, sig: ["SIGTERM", "active"], exit: ["-", ""] },
  { phase: 7, hooks: { http: 1, nats: 1, db: 1, redis: 1, otel: 1 }, budget: 0.74, sig: ["SIGTERM", "active"], exit: ["returns", "ok"] },
  { phase: 4, hooks: { http: 1, nats: 1, db: 1, redis: "stuck" }, budget: 1.1, sig: ["SIGTERM", "active"], exit: ["os.Exit(1)", "err"], watchdog: true },
  { phase: 4, hooks: { http: 1, nats: 1, db: 1, redis: "stuck" }, budget: 0.5, sig: ["SIGTERM x2", "err"], exit: ["os.Exit(130)", "err"] },
]

function apply(h, step) {
  const s = STEPS[step]
  h.text("sig-t", s.sig[0])
  h.state("sig", s.sig[1])
  h.state("sig-t", s.sig[1])
  h.text("exit-t", s.exit[0])
  h.state("exit", s.exit[1])
  h.state("exit-t", s.exit[1])
  // The budget fills up to the end of the bar; past 1.0 it runs into the grace slot.
  const bw = s.budget <= 1 ? s.budget * BAR_W : BAR_W + 2 + (GRACE_W - 2)
  h.q("budget").style.width = `${Math.max(0, bw)}px`
  h.state("budget", s.watchdog ? "err" : s.budget > 0 ? "active" : "")

  PHASES.forEach(([, , hooks], i) => {
    const done = i < s.phase
    const cur = i === s.phase
    h.state(`rowbg${i}`, cur ? (s.watchdog || step === 8 ? "err" : "active") : "")
    h.cls(`rowbg${i}`, { "is-hidden": !cur })
    h.dim(`row${i}`, step > 0 && !cur && !done)
    let st = step === 0 ? "waiting" : done ? (hooks.length ? "done" : "skipped") : cur ? (hooks.length ? "running" : "nothing to do") : "waiting"
    if (cur && (s.watchdog || step === 8)) st = s.watchdog ? "watchdog" : "forced"
    h.text(`st${i}`, st)
    h.state(`st${i}`, cur ? (s.watchdog || step === 8 ? "err" : "active") : done && hooks.length ? "ok" : "")
  })
  for (const hk of HOOKS) {
    const v = s.hooks[hk] ?? 0
    const el = h.q(`fill-${hk}`)
    // A running hook fills slowly, so parallel hooks are seen moving together.
    el.style.transitionDuration = v === "run" ? "2.4s" : ""
    el.style.width = `${v === 1 ? PILL_W : v === "run" ? PILL_W * 0.85 : v === "stuck" ? PILL_W * 0.5 : 0}px`
    h.state(`fill-${hk}`, v === 1 ? "ok" : v === "run" ? "active" : v === "stuck" ? "err" : "")
  }
}

register("shutdown-phases", { build, apply, steps: STEPS.length, preview: 4 })
