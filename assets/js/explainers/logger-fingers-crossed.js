// logger FingersCrossed: debug lines for a request are held in a per-request buffer.
// If the request succeeds nothing below the activation level is written; the first
// error flushes the buffered trail plus the error. Source: ubgo/logger README,
// "Debug-on-error (FingersCrossed)" (the "loaded config" / "queried db" / "boom" lines
// are the README's own example).
import { helpers, register, svg } from "./stepper.js"

const W = 440
const H = 280
const COL = { code: 12, buf: 158, sink: 304 }
const COL_W = 124
const ROW_Y = [92, 124, 156]
const CHIP_W = 112

const LINES = [
  ["D", "loaded config"],
  ["D", "queried db"],
  ["E", "boom"],
]

function chip(i) {
  const [lvl, msg] = LINES[i]
  const err = lvl === "E"
  return `<g data-k="c${i}" class="xp-anim">
<rect data-k="c${i}-r" class="xp-box xp-anim${err ? " is-err" : ""}" x="0" y="0" width="${CHIP_W}" height="24" rx="6"/>
<rect class="xp-fill${err ? " is-err" : " is-active"}" x="0" y="0" width="20" height="24" rx="6"/>
<rect class="xp-fill${err ? " is-err" : " is-active"}" x="12" y="0" width="8" height="24"/>
<text x="10" y="16" text-anchor="middle" class="xp-s xp-mono xp-b" style="fill:#fff">${lvl}</text>
<text x="28" y="16" class="xp-s">${msg}</text></g>`
}

function column(k, x, title, sub) {
  return `<rect data-k="${k}" class="xp-box xp-anim xp-shadow" x="${x}" y="48" width="${COL_W}" height="184" rx="12"/>
<text x="${x + 12}" y="68" class="xp-s xp-b">${title}</text>
<text data-k="${k}-sub" x="${x + 12}" y="${232 - 12}" class="xp-s xp-m">${sub}</text>`
}

function build(stage) {
  stage.innerHTML = svg(
    W,
    H,
    `
<text data-k="req" x="12" y="30" class="xp-l">Request 1</text>
<text data-k="req-sub" x="428" y="30" text-anchor="end" class="xp-s xp-m xp-mono">ctx := logger.FCScope(r.Context())</text>
${column("code", COL.code, "handler", "")}
${column("buf", COL.buf, "request buffer", "empty")}
${column("sink", COL.sink, "stderr sink", "nothing written")}
<path data-k="w1" class="xp-wire xp-anim" d="M${COL.code + COL_W} 140 H${COL.buf}"/>
<path data-k="w2" class="xp-wire xp-anim" d="M${COL.buf + COL_W} 140 H${COL.sink}"/>
${chip(0)}${chip(1)}${chip(2)}
<rect data-k="ok-badge" class="xp-box is-ok xp-anim" x="${COL.code + 8}" y="186" width="${COL_W - 16}" height="22" rx="11"/>
<text data-k="ok-badge-t" x="${COL.code + COL_W / 2}" y="201" text-anchor="middle" class="xp-s xp-b is-ok xp-anim">request OK</text>
<text data-k="note" x="220" y="262" text-anchor="middle" class="xp-s xp-b xp-anim"></text>
`,
    "Debug lines wait in a per-request buffer and are written only when an error arrives",
  )
  return helpers(stage)
}

// Chip placement per step: "code" (in the handler), "buf", "sink", or "" (hidden).
const STEPS = [
  { req: 1, chips: ["", "", ""], buf: "empty", sink: "nothing written", note: "" },
  { req: 1, chips: ["buf", "", ""], buf: "1 line held", sink: "nothing written", note: "" },
  { req: 1, chips: ["buf", "buf", ""], buf: "2 lines held", sink: "nothing written", note: "" },
  { req: 1, chips: ["gone", "gone", ""], buf: "never written", sink: "nothing written", note: "Success: the sink stays silent", ok: true },
  { req: 2, chips: ["buf", "buf", ""], buf: "2 lines held", sink: "nothing written", note: "" },
  { req: 2, chips: ["buf", "buf", "code"], buf: "2 lines held", sink: "nothing written", note: "", err: true },
  { req: 2, chips: ["sink", "sink", "sink"], buf: "flushed", sink: "3 lines written", note: "The error brings its whole debug trail", err: true },
]

function pos(where, i) {
  if (where === "code" || where === "") return [COL.code + 6, ROW_Y[i]]
  if (where === "buf" || where === "gone") return [COL.buf + 6, ROW_Y[i]]
  return [COL.sink + 6, ROW_Y[i]]
}

function apply(h, step) {
  const s = STEPS[step]
  h.text("req", `Request ${s.req}`)
  s.chips.forEach((where, i) => {
    const [x, y] = pos(where, i)
    h.move(`c${i}`, x, y)
    h.show(`c${i}`, where !== "" && where !== "gone")
  })
  h.text("code-sub", ["request starts", "DebugContext", "DebugContext", "handler returns", "2 DebugContext calls", "ErrorContext", "ErrorContext"][step])
  h.text("buf-sub", s.buf)
  h.text("sink-sub", s.sink)
  h.state("buf", step === 0 || step === 4 ? "active" : s.chips.includes("buf") ? "active" : step === 3 ? "" : "")
  h.state("sink", step === 6 ? "err" : "")
  h.state("code", s.err ? "err" : "")
  h.state("w1", s.chips.includes("buf") && step !== 5 ? "active" : "")
  h.state("w2", step === 6 ? "err" : "")
  h.show("ok-badge", !!s.ok)
  h.show("ok-badge-t", !!s.ok)
  h.state("sink-sub", step === 6 ? "err" : step === 3 ? "ok" : "")
  h.text("note", s.note)
  h.state("note", step === 3 ? "ok" : step === 6 ? "err" : "")
}

register("logger-fingers-crossed", { build, apply, steps: STEPS.length, preview: 6 })
