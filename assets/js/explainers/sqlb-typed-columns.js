// sqlb: typed columns. Wrong-type comparisons, scans and joins fail at compile time;
// an engine expression under the wrong dialect fails at Build; execution is proven
// against a real database. Source: ubgo/sqlb README, "Checked three times, not claimed
// once" and "Get started" (the users table). The compiler messages below are real Go
// 1.24+ output from building these exact statements against the sqlb source, with the
// file:line:col prefix removed (it would point into a scratch file, not this snippet).
import { esc, helpers, register, svg } from "./stepper.js"

const W = 440
const H = 120
const NODES = [
  { x: 14, title: "Compiler", sub: "go build" },
  { x: 160, title: "Build()", sub: "in your process" },
  { x: 306, title: "Database", sub: "real execution" },
]
const NODE_W = 120

// Each step: code lines (markup in codeHTML), which checkpoint answers (at) and how
// (tone), and the panel text under the code.
const QUERY = (where, cols = "sqlb.Bind(users.Email, &email)") => [
  "q, err := pg.Select().",
  `  Columns(${cols}).`,
  "  From(users.Table).",
  `  Where(${where}).`,
  "  Build()",
]
const STEPS = [
  {
    code: ["var Table = sqlb.Table{Name: \"app_user\", Alias: \"u\"}", "", "var (", "+  ID        = sqlb.Col[string](Table, \"id\")", "+  Email     = sqlb.Col[string](Table, \"email\")", "+  CreatedAt = sqlb.Col[time.Time](Table, \"created_at\")", ")"],
    file: "users/users.go",
    at: -1,
    panel: ["Types", "Email is an sqlb.Expr[string]. CreatedAt is an sqlb.Expr[time.Time]. No generator, nothing to re-run."],
    tone: "",
  },
  {
    code: ["var email string", "", ...QUERY('{{sqlb.Eq(users.ID, "usr_1")}}')],
    file: "app/query.go",
    at: 1,
    panel: ["$ go build ./...", "(no output: the build succeeds)"],
    tone: "ok",
  },
  {
    code: ["var email string", "", ...QUERY("[[sqlb.Eq(users.Email, 42)]]")],
    file: "app/query.go",
    at: 0,
    panel: ["$ go build ./...", "cannot use 42 (untyped int constant) as string value in argument to sqlb.Eq"],
    tone: "err",
  },
  {
    code: ["var n int", "", ...QUERY('sqlb.Eq(users.ID, "usr_1")', "[[sqlb.Bind(users.Email, &n)]]")],
    file: "app/query.go",
    at: 0,
    panel: ["$ go build ./...", "in call to sqlb.Bind, type *int of &n does not match inferred type *string for *T"],
    tone: "err",
  },
  {
    code: ["Join(sqlb.Join{", "  Type:  sqlb.JoinInner,", "  Table: invoices.Table,", "  On: []sqlb.Predicate{", "    [[sqlb.EqExpr(users.ID, users.CreatedAt)]],", "  },", "})"],
    file: "app/query.go",
    at: 0,
    panel: ["$ go build ./...", 'in call to sqlb.EqExpr, type sqlb.Expr["time".Time] of users.CreatedAt does not match inferred type sqlb.Expr[string] for sqlb.Expr[T]'],
    tone: "err",
  },
  {
    code: ["q, err := sqlite.Select().", "  Columns(sqlb.Bind(users.Email, &email)).", "  From(users.Table).", "  [[Clause(pg.ForUpdate())]].", "  Build()"],
    file: "app/query.go",
    at: 0,
    panel: ["$ go build ./...", 'cannot use pg.ForUpdate() (value of interface type pg.SelectClause) as stmt.Clause["github.com/ubgo/sqlb/sqlite".Dialect, stmt.SelectKind] value in argument to … Clause (wrong type for method ClauseOf)'],
    tone: "err",
  },
  {
    code: ["dist := [[vector.L2(embedding, vector.ParamVector(query))]]", "", "_, err := sqlb.NewSelect(sqlb.SQLiteDialect{}).", "  Columns(sqlb.Bind(dist, &d)).", "  From(docs).", "  Build()"],
    file: "app/search.go",
    at: 1,
    panel: ["err from Build()", 'sqlb: construct is not supported by this dialect\n     vector.L2 under dialect "sqlite"'],
    tone: "err",
  },
  {
    code: ["var email string", "", ...QUERY('sqlb.Eq(users.ID, "usr_1")'), "", "+err = sqlb.One(ctx, db, q)"],
    file: "app/query.go",
    at: 2,
    panel: ["Proven by running it", "sqlbtest is a shared conformance suite every driver runs. contrib/driver-pgx executes every pg construct, 593 cases, against Postgres 17."],
    tone: "ok",
  },
]

function build(stage, opts = {}) {
  let nodes = ""
  NODES.forEach((n, i) => {
    nodes += `<rect data-k="n${i}" class="xp-box xp-anim xp-shadow" x="${n.x}" y="34" width="${NODE_W}" height="58" rx="11"/>
<text x="${n.x + 14}" y="58" class="xp-b">${n.title}</text>
<text x="${n.x + 14}" y="78" class="xp-s xp-m">${n.sub}</text>
<circle data-k="m${i}" class="xp-fill xp-anim" cx="${n.x + NODE_W - 18}" cy="52" r="8"/>
<text data-k="mt${i}" x="${n.x + NODE_W - 18}" y="56.5" text-anchor="middle" class="xp-s xp-b xp-anim" style="fill:#fff"></text>`
    if (i < 2) nodes += `<path data-k="a${i}" class="xp-wire xp-anim" d="M${n.x + NODE_W} 63 H${NODES[i + 1].x}"/>`
  })
  if (opts.preview) {
    // Index card: the checkpoints plus the offending call, all in SVG so it scales.
    stage.innerHTML = svg(
      W,
      220,
      `<text x="14" y="22" class="xp-s xp-m">Where each mistake is caught</text>
${nodes}
<text data-k="verdict" x="426" y="22" text-anchor="end" class="xp-s xp-b"></text>
<rect class="xp-box" x="14" y="112" width="412" height="92" rx="10"/>
<text x="28" y="140" class="xp-mono xp-s">Where(<tspan class="is-err" style="fill:var(--xp-err)">sqlb.Eq(users.Email, 42)</tspan>)</text>
<text x="28" y="170" class="xp-mono xp-s is-err">cannot use 42 (untyped int constant)</text>
<text x="28" y="188" class="xp-mono xp-s is-err">as string value in argument to sqlb.Eq</text>`,
      "sqlb checkpoints",
    )
    const h = helpers(stage)
    return { ...h, q: (k) => stage.querySelector(`[data-k="${k}"]`) || document.createElement("div") }
  }
  stage.innerHTML = `${svg(
    W,
    H,
    `<text x="14" y="22" class="xp-s xp-m">Where each mistake is caught</text>
${nodes}
<text data-k="verdict" x="426" y="22" text-anchor="end" class="xp-s xp-b xp-anim"></text>`,
    "Three checkpoints: the compiler, Build() and a real database",
  )}
<div class="px-3 sm:px-4 pb-3 pt-1 max-w-[620px] mx-auto">
  <div class="rounded-lg border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-950/60 overflow-hidden shadow-sm shadow-slate-900/5">
    <div class="flex items-center gap-1.5 px-3 h-7 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
      <span class="size-2 rounded-full bg-slate-300 dark:bg-slate-700"></span><span class="size-2 rounded-full bg-slate-300 dark:bg-slate-700"></span><span class="size-2 rounded-full bg-slate-300 dark:bg-slate-700"></span>
      <span data-k="file" class="ml-2 font-mono"></span>
    </div>
    <pre data-k="code" class="m-0 px-3 py-2 font-mono text-[12px] leading-[1.6] text-slate-800 dark:text-slate-200 overflow-x-auto min-h-[10.5rem]"></pre>
  </div>
  <div data-k="panel" class="xp-html-anim mt-2 rounded-lg border px-3 py-2 font-mono text-[12px] leading-relaxed min-h-[5.25rem]">
    <div data-k="panel-h" class="text-[11px] opacity-80"></div>
    <div data-k="panel-b" class="mt-0.5 whitespace-pre-wrap break-words"></div>
  </div>
</div>`
  return helpers(stage)
}

const PANEL_TONE = {
  "": "border-slate-200 dark:border-slate-700/80 bg-white/70 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300",
  ok: "border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  err: "border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-200",
}

// Code markup: a line starting with "!" is the offending line, "+" a line that type
// checks; inside a line, [[...]] marks the offending call and {{...}} a good one.
const BAD = "underline decoration-wavy decoration-rose-500 underline-offset-4 bg-rose-500/10 rounded-sm"
const GOOD = "bg-emerald-500/15 rounded-sm"
function codeHTML(lines) {
  return lines
    .map((l) => {
      const inline = esc(l)
        .replace(/\[\[(.+?)\]\]/g, `<span class="${BAD}">$1</span>`)
        .replace(/\{\{(.+?)\}\}/g, `<span class="${GOOD}">$1</span>`)
      if (l.startsWith("!")) return `<span class="block -mx-3 px-3 bg-rose-500/10"><span class="${BAD}">${inline.slice(1)}</span></span>`
      if (l.startsWith("+")) return `<span class="block -mx-3 px-3 bg-emerald-500/10">${inline.slice(1)}</span>`
      return inline || " "
    })
    .join("\n")
}

function apply(h, step) {
  const s = STEPS[step]
  h.q("code").innerHTML = codeHTML(s.code)
  h.text("file", s.file)
  h.text("panel-h", s.panel[0])
  h.text("panel-b", s.panel[1])
  h.q("panel").className = `xp-html-anim mt-2 rounded-lg border px-3 py-2 font-mono text-[12px] leading-relaxed min-h-[5.25rem] ${PANEL_TONE[s.tone]}`
  // Checkpoints: before the one that answers = passed, the one that answers = its tone,
  // after it = never reached. at -1 means nothing has been checked yet.
  NODES.forEach((_, i) => {
    let st = ""
    let mark = ""
    if (s.at >= 0) {
      if (i < s.at || (i === s.at && s.tone === "ok")) {
        st = "ok"
        mark = "✓"
      } else if (i === s.at) {
        st = s.tone
        mark = "✗"
      }
    }
    h.state(`n${i}`, st)
    h.state(`m${i}`, st)
    h.text(`mt${i}`, mark)
    h.dim(`n${i}`, s.at >= 0 && i > s.at)
    if (i < 2) h.state(`a${i}`, s.at > i ? "ok" : "")
  })
  const v = s.at < 0 ? "" : s.tone === "ok" ? (s.at === 2 ? "runs on a real database" : "compiles and builds") : s.at === 0 ? "does not compile" : "compiles, Build() refuses"
  h.text("verdict", v)
  h.state("verdict", s.tone)
}

register("sqlb-typed-columns", { build, apply, steps: STEPS.length, preview: 2 })
