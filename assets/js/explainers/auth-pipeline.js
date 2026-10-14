// auth: one pipeline for every entry point. An operation such as password.sign-in is
// defined once and served as an HTTP route, a GraphQL mutation and a typed Go call; all
// three run the same eight steps in order and stop at the first failure.
// Source: ubgo/auth README, "Quick start" (one pipeline: rate limits, the CSRF origin
// check, the session, hooks, one transaction) and "Why auth?" (one pipeline for every
// entry point); the step order is docs/concepts/plugins-and-pipeline.md, "Step 3 — Know
// the pipeline order", and the refusal is docs/concepts/rate-limits.md
// (auth.rate_limited, 429 with Retry-After).
import { helpers, register, svg } from "./stepper.js"

const W = 460
const H = 344
const ENTRY_W = 138
const ENTRY_X = [10, 161, 312]
const ENTRIES = [
  ["http", "HTTP route", "POST …/sign-in"],
  ["gql", "GraphQL", "a mutation"],
  ["go", "Go call", "pw.SignIn(ctx, …)"],
]
const ROWS = [
  "Rate limit by client address",
  "Origin check",
  "Session, resolved once",
  "Requirement: Public",
  "Decode input, per-account limit",
  "One transaction",
  "Hooks before, operation, hooks after",
  "Commit, then effects",
]
const ROW0 = 104
const ROW_H = 24

function build(stage, opts = {}) {
  let entries = ""
  ENTRIES.forEach(([k, label, call], i) => {
    const x = ENTRY_X[i]
    const cx = x + ENTRY_W / 2
    entries += `<g data-k="eg-${k}" class="xp-anim"><rect data-k="e-${k}" class="xp-box xp-anim" x="${x}" y="10" width="${ENTRY_W}" height="42" rx="9"/>
<text x="${cx}" y="27" text-anchor="middle" class="xp-s xp-m">${label}</text>
<text x="${cx}" y="44" text-anchor="middle" class="xp-mono" style="font-size:11px">${call}</text></g>
<path data-k="w-${k}" class="xp-wire xp-anim" d="M${cx} 52 C${cx} 64 ${W / 2} 60 ${W / 2} 72"/>`
  })
  let rows = ""
  ROWS.forEach((name, i) => {
    const y = ROW0 + i * ROW_H
    rows += `<g data-k="row${i}" class="xp-anim">
<rect data-k="rowbg${i}" class="xp-box xp-anim" x="10" y="${y}" width="${W - 20}" height="${ROW_H - 4}" rx="6"/>
<text x="22" y="${y + 14}" class="xp-s xp-m xp-mono">${i + 1}</text>
<text x="40" y="${y + 14}" class="xp-s">${name}</text>
<text data-k="st${i}" x="${W - 22}" y="${y + 14}" text-anchor="end" class="xp-s xp-m xp-anim">waiting</text></g>`
  })
  const ry = ROW0 + ROWS.length * ROW_H + 6
  stage.innerHTML = svg(
    W,
    H,
    `
${entries}
<rect data-k="op" class="xp-box xp-anim" x="${W / 2 - 110}" y="72" width="220" height="24" rx="12"/>
<text x="${W / 2}" y="88" text-anchor="middle" class="xp-s"><tspan class="xp-m">one operation: </tspan><tspan class="xp-mono xp-b">password.sign-in</tspan></text>
${rows}
<rect data-k="res" class="xp-box xp-anim" x="10" y="${ry}" width="${W - 20}" height="${H - ry - 8}" rx="9"/>
<text x="22" y="${ry + 19}" class="xp-s xp-m">answer</text>
<text data-k="res-t" x="${W - 22}" y="${ry + 19}" text-anchor="end" class="xp-s xp-mono xp-b">-</text>
`,
    "Three entry points feed one operation, which runs eight pipeline steps in order",
  )
  // The index card is wider than tall: show only the operation and its eight steps.
  if (opts.preview) stage.querySelector("svg").setAttribute("viewBox", `0 66 ${W} ${ROWS.length * ROW_H + 44}`)
  return helpers(stage)
}

// cur: the row being run (-1 none). done: rows finished before it. err: cur refused.
const STEPS = [
  { in: ["http", "gql", "go"], cur: -1, res: ["-", ""] },
  { in: ["http"], cur: 0, res: ["-", ""] },
  { in: ["http"], cur: 1, res: ["-", ""] },
  { in: ["http"], cur: 2, res: ["-", ""] },
  { in: ["http"], cur: 3, res: ["-", ""] },
  { in: ["http"], cur: 4, res: ["-", ""] },
  { in: ["http"], cur: 5, res: ["-", ""] },
  { in: ["http"], cur: 6, res: ["-", ""] },
  { in: ["http"], cur: 7, res: ["Set-Cookie", "ok"] },
  { in: ["http"], cur: 0, err: true, res: ["429 auth.rate_limited", "err"] },
  { in: ["gql", "go"], cur: 8, res: ["the same answer", "ok"] },
]

function apply(h, step) {
  const s = STEPS[step]
  for (const [k] of ENTRIES) {
    const on = s.in.includes(k)
    h.state(`e-${k}`, on ? (s.err ? "err" : "active") : "")
    h.state(`w-${k}`, on && s.cur >= 0 ? (s.err ? "err" : "active") : "")
    h.dim(`eg-${k}`, !on)
  }
  h.state("op", s.cur >= 0 ? (s.err ? "err" : "active") : "active")
  ROWS.forEach((_, i) => {
    const done = i < s.cur
    const cur = i === s.cur
    const skipped = s.err && i > s.cur
    h.state(`rowbg${i}`, cur ? (s.err ? "err" : i === 7 ? "ok" : "active") : done ? "ok" : "")
    h.dim(`row${i}`, skipped || (s.cur >= 0 && s.cur < 8 && !done && !cur))
    const st = skipped ? "never runs" : cur ? (s.err ? "refused" : i === 7 ? "done" : "running") : done ? "passed" : "waiting"
    h.text(`st${i}`, st)
    h.state(`st${i}`, cur ? (s.err ? "err" : i === 7 ? "ok" : "active") : done ? "ok" : "")
  })
  h.text("res-t", s.res[0])
  h.state("res", s.res[1])
  h.state("res-t", s.res[1])
}

register("auth-pipeline", { build, apply, steps: STEPS.length, preview: 6 })
