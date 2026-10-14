// Home page hero diagram: one library's real core in the middle (drawn like the
// logo: a "u" holding one amber block), the adapters that plug into it, and, only
// where data/libraries.yaml lists one, the shared conformance suite that proves
// them. Data comes from <script id="hero-data"> written by
// layouts/_partials/hero-diagram.html; nothing here invents a number.
//
// Layout is computed from the stage width: wide (>= 640px) puts adapters in two
// columns either side of the core; narrow stacks the core on top and the adapters
// in a two-column grid fed by two rails. The SVG height is the tallest layout over
// every library at that width, so swapping libraries never moves the page.

const root = document.querySelector("[data-hero]")
const dataEl = document.getElementById("hero-data")

const NS = "http://www.w3.org/2000/svg"
/** Width below which the stacked phone layout is used. */
const NARROW = 640
/** Max adapter nodes drawn (the last slot becomes "+N more" when there are more). */
const MAX_WIDE = 12
const MAX_NARROW = 10
/** JetBrains Mono advance is 0.6em, so text width is predictable without measuring. */
const MONO = 0.6

function el(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag)
  if (attrs) for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) n.setAttribute(k, attrs[k])
  if (parent) parent.appendChild(n)
  return n
}

function text(parent, str, attrs) {
  const t = el("text", attrs, parent)
  t.textContent = str
  return t
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`
}

/** Pick which adapters to draw: suite members always, then data order, capped. */
function pickAdapters(lib, max) {
  const ads = lib.adapters
  if (ads.length <= max) return { shown: ads, more: 0 }
  const suite = new Set([...(lib.suite?.passes || []), ...(lib.suite?.fails || [])])
  const keep = new Set()
  for (const a of ads) if (suite.has(a.name) && keep.size < max - 1) keep.add(a)
  for (const a of ads) if (keep.size < max - 1) keep.add(a)
  const shown = ads.filter((a) => keep.has(a))
  return { shown, more: ads.length - shown.length }
}

function status(lib, name) {
  if (!lib.suite) return ""
  if ((lib.suite.passes || []).includes(name)) return "pass"
  if ((lib.suite.fails || []).includes(name)) return "fail"
  return ""
}

function factChips(lib) {
  const out = []
  if (typeof lib.coreDeps === "number") out.push(`core: ${plural(lib.coreDeps, "direct dep", "direct deps")}`)
  if (lib.go) out.push(`go ${lib.go}`)
  if (lib.license) out.push(lib.license)
  out.push(lib.tag || "no release yet")
  return out
}

function groupWord(lib, n) {
  if (lib.source === "family") return plural(n, "backend", "backends")
  if (lib.source === "packages") return plural(n, "module", "modules")
  // auth draws two kinds of node, so name both counts whatever n is.
  if (lib.source === "plugins") return `${plural(lib.plugins, "plugin", "plugins")} and ${plural(lib.contribs, "adapter", "adapters")}`
  return plural(n, "adapter", "adapters")
}

// ---- layout -------------------------------------------------------------

/** Lay chips out in rows no wider than maxW; returns [{label,x,y,w}] relative to a centered origin. */
function chipRows(labels, maxW, size) {
  const h = 22
  const gap = 6
  const rows = [[]]
  let rowW = 0
  for (const l of labels) {
    const w = Math.ceil(l.length * size * MONO) + 16
    if (rows[rows.length - 1].length && rowW + gap + w > maxW) {
      rows.push([])
      rowW = 0
    }
    rows[rows.length - 1].push({ label: l, w })
    rowW += (rowW ? gap : 0) + w
  }
  const out = []
  rows.forEach((row, i) => {
    const total = row.reduce((s, c) => s + c.w, 0) + gap * (row.length - 1)
    let x = -total / 2
    for (const c of row) {
      out.push({ ...c, x, y: i * (h + gap), h })
      x += c.w + gap
    }
  })
  return { chips: out, height: rows.length * (h + gap) - gap }
}

function layout(lib, W) {
  const narrow = W < NARROW
  const { shown, more } = pickAdapters(lib, narrow ? MAX_NARROW : MAX_WIDE)
  const items = shown.map((a) => ({ ...a, status: status(lib, a.name) }))
  if (more) items.push({ name: `+${more} more`, href: lib.href, more: true, status: "" })
  return narrow ? layoutNarrow(lib, W, items) : layoutWide(lib, W, items)
}

function layoutWide(lib, W, items) {
  const tile = 104
  const nodeW = 200
  const nodeH = 30
  const gapY = 10
  const top = 28
  const cx = W / 2
  const gapX = Math.max(56, Math.min(210, W / 2 - tile / 2 - nodeW - 24))
  const leftN = Math.ceil(items.length / 2)
  const rows = Math.max(leftN, items.length - leftN)
  const colH = rows * (nodeH + gapY) - gapY

  const midW = 2 * (tile / 2 + gapX) - 28
  const chips = chipRows(factChips(lib), midW, 11)
  const suiteW = Math.min(300, midW)
  const blockH = tile + 14 + 20 + 10 + chips.height + (lib.suite ? 14 + 50 : 0)

  let cy = top + tile / 2 + Math.max(0, (colH - blockH) / 2)
  // Keep the columns from rising above the top edge.
  cy = Math.max(cy, top + colH / 2)
  const nodes = items.map((it, i) => {
    const left = i < leftN
    const row = left ? i : i - leftN
    const n = left ? leftN : items.length - leftN
    const y = cy - (n * (nodeH + gapY) - gapY) / 2 + row * (nodeH + gapY)
    const x = left ? cx - tile / 2 - gapX - nodeW : cx + tile / 2 + gapX
    // Wire from a port on the tile's side to the node's inner edge.
    const portSpread = Math.min(64, (n - 1) * 14)
    const py = cy - portSpread / 2 + (n > 1 ? (row * portSpread) / (n - 1) : 0)
    const px = left ? cx - tile / 2 : cx + tile / 2
    const ex = left ? x + nodeW : x
    const ey = y + nodeH / 2
    const k = (ex - px) * 0.5
    return { ...it, x, y, w: nodeW, h: nodeH, wire: `M${px},${py} C${px + k},${py} ${ex - k},${ey} ${ex},${ey}` }
  })
  const blockTop = cy - tile / 2
  const nameY = blockTop + tile + 14 + 14
  const chipsY = nameY + 16
  const suiteY = chipsY + chips.height + 14
  const bottom = Math.max(cy + colH / 2, lib.suite ? suiteY + 50 : chipsY + chips.height)
  return {
    W, H: bottom + 24, narrow: false, cx, cy, tile, nodes,
    name: { x: cx, y: nameY }, chips: { x: cx, y: chipsY, list: chips.chips },
    suite: lib.suite ? { x: cx - suiteW / 2, y: suiteY, w: suiteW, h: 50 } : null,
  }
}

function layoutNarrow(lib, W, items) {
  const tile = 72
  const pad = 14
  const rail = 8
  const gapX = 10
  const nodeH = 30
  const gapY = 8
  const top = 20
  const cx = W / 2
  const cy = top + tile / 2
  const nameY = top + tile + 26
  const chips = chipRows(factChips(lib), W - 2 * pad, 10.5)
  const chipsY = nameY + 14
  let y = chipsY + chips.height
  let suite = null
  if (lib.suite) {
    const sw = Math.min(300, W - 2 * pad)
    suite = { x: cx - sw / 2, y: y + 12, w: sw, h: 50 }
    y = suite.y + suite.h
  }
  const busY = y + 22
  const gridTop = busY + 16
  const colW = (W - 2 * (pad + rail) - gapX) / 2
  const xL = pad + rail
  const xR = xL + colW + gapX
  const railL = pad
  const railR = W - pad
  const nodes = items.map((it, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const x = col ? xR : xL
    const ny = gridTop + row * (nodeH + gapY)
    const ey = ny + nodeH / 2
    const rx = col ? railR : railL
    const ex = col ? x + colW : x
    return { ...it, x, y: ny, w: colW, h: nodeH, wire: `M${rx},${busY} V${ey - 6} Q${rx},${ey} ${rx + (col ? -6 : 6)},${ey} H${ex}` }
  })
  const rows = Math.ceil(items.length / 2)
  const bottom = gridTop + rows * (nodeH + gapY) - gapY
  return {
    W, H: bottom + 20, narrow: true, cx, cy, tile, nodes,
    name: { x: cx, y: nameY }, chips: { x: cx, y: chipsY, list: chips.chips }, suite,
    // The trunk leaves from under the info block so it never crosses the labels.
    trunk: `M${cx},${y + 4} V${busY} M${railL},${busY + 6} Q${railL},${busY} ${railL + 6},${busY} H${railR - 6} Q${railR},${busY} ${railR},${busY + 6}`,
  }
}

// ---- drawing ------------------------------------------------------------

function drawDefs(svg) {
  const defs = el("defs", null, svg)
  const g = el("linearGradient", { id: "hd-tile", x1: "0", y1: "0", x2: "1", y2: "1" }, defs)
  el("stop", { offset: "0", "stop-color": "#0891B2" }, g)
  el("stop", { offset: "1", "stop-color": "#155E75" }, g)
  const p = el("pattern", { id: "hd-dots", width: "16", height: "16", patternUnits: "userSpaceOnUse" }, defs)
  el("circle", { cx: "1", cy: "1", r: "1", class: "hd-dots" }, p)
}

/** The core, drawn as the logo: a rounded tile, a white "u" and one amber block. */
function drawCore(g, L, lib) {
  const s = L.tile
  const a = el("a", { href: lib.href, class: "hd-core", "aria-label": `${lib.name} core: open library page` }, g)
  const t = el("g", { transform: `translate(${L.cx - s / 2},${L.cy - s / 2})` }, a)
  el("rect", { x: -6, y: -6, width: s + 12, height: s + 12, rx: s * 0.3, class: "hd-halo" }, t)
  el("rect", { width: s, height: s, rx: s * 0.22, fill: "url(#hd-tile)" }, t)
  const k = s / 512
  el("path", { d: `M${176 * k} ${140 * k} V${276 * k} a${80 * k} ${80 * k} 0 0 0 ${160 * k} 0 V${140 * k}`, stroke: "#fff", "stroke-width": 64 * k, "stroke-linecap": "round", fill: "none" }, t)
  el("rect", { x: 226 * k, y: 202 * k, width: 60 * k, height: 60 * k, rx: 14 * k, fill: "#FBBF24" }, t)
  el("title", null, a).textContent = `${lib.name} (core module)`
}

function drawLabels(g, L, lib) {
  text(g, lib.name, { x: L.name.x, y: L.name.y, "text-anchor": "middle", class: "hd-mono", "font-size": L.narrow ? 15 : 16, "font-weight": 600 })
  for (const c of L.chips.list) {
    const cg = el("g", { class: "hd-chip", transform: `translate(${L.chips.x + c.x},${L.chips.y + c.y})` }, g)
    el("rect", { width: c.w, height: c.h, rx: 6 }, cg)
    text(cg, c.label, { x: c.w / 2, y: c.h / 2 + 3.8, "text-anchor": "middle", class: "hd-mono", "font-size": L.narrow ? 10.5 : 11 })
  }
  if (L.suite) {
    const s = L.suite
    const sg = el("g", { class: "hd-suite", transform: `translate(${s.x},${s.y})` }, g)
    el("rect", { width: s.w, height: s.h, rx: 10, class: "hd-suite-box" }, sg)
    // A little flask-free mark: three ticks in a box, reads as "tests".
    const ig = el("g", { transform: "translate(12,13)" }, sg)
    el("rect", { width: 24, height: 24, rx: 6, class: "hd-pass-dot" }, ig)
    el("path", { d: "M7 12.5l3.2 3.2L17 9", fill: "none", stroke: "var(--hd-check-ink)", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" }, ig)
    text(sg, lib.suite.name, { x: 46, y: 22, class: "hd-mono", "font-size": 12.5, "font-weight": 600 })
    const p = (lib.suite.passes || []).length
    const f = (lib.suite.fails || []).length
    text(sg, `conformance suite · ${p} pass${f ? ` · ${f} does not` : ""}`, { x: 46, y: 38, class: "hd-muted", "font-size": 11.5 })
  }
}

function drawNode(g, n, i, lib, L) {
  const a = el("a", { href: n.href, class: `hd-node hd-anim${n.more ? " hd-more" : ""}${n.status ? ` is-${n.status}` : ""}` }, g)
  a.style.transform = `translate(${n.x}px,${n.y}px)`
  el("rect", { width: n.w, height: n.h, rx: 8 }, a)
  const badge = n.status ? 22 : 0
  const size = L.narrow ? 11 : 12
  const t = text(a, n.name, { x: 11, y: n.h / 2 + size * 0.36, class: `hd-mono${n.more ? " hd-muted" : ""}`, "font-size": size })
  const room = n.w - 22 - badge
  if (n.name.length * size * MONO > room) {
    t.setAttribute("textLength", room)
    t.setAttribute("lengthAdjust", "spacingAndGlyphs")
  }
  const bx = n.w - 15
  const by = n.h / 2
  if (n.status === "pass") {
    const b = el("g", { transform: `translate(${bx},${by})` }, a)
    el("circle", { r: 8, class: "hd-pass-dot" }, b)
    el("path", { d: "M-3.6,0.3 L-1,2.9 L3.8,-2.4", class: "hd-check" }, b)
  } else if (n.status === "fail") {
    const b = el("g", { transform: `translate(${bx},${by})` }, a)
    el("circle", { r: 7.25, class: "hd-fail-ring" }, b)
    el("path", { d: "M-2.8,-2.8 L2.8,2.8 M2.8,-2.8 L-2.8,2.8", class: "hd-fail-x" }, b)
  }
  const st = n.status === "pass" ? ` (passes ${lib.suite.name})` : n.status === "fail" ? ` (does not pass ${lib.suite.name})` : ""
  el("title", null, a).textContent = n.more ? `${n.name}: see every module on the ${lib.name} page` : `${n.name}${st}`
  a.style.setProperty("--d", `${0.55 + i * 0.09}s`)
  return a
}

function describe(lib, L) {
  const names = L.nodes.filter((n) => !n.more).map((n) => n.name)
  const extra = L.nodes.find((n) => n.more)
  let s = `Core module ${lib.name} with ${groupWord(lib, lib.adapters.length)}: ${names.join(", ")}${extra ? ` and ${extra.name.replace("+", "")}` : ""}.`
  if (lib.suite) {
    s += ` Shared suite ${lib.suite.name}: passed by ${(lib.suite.passes || []).join(", ")}.`
    if ((lib.suite.fails || []).length) s += ` Not passed by ${lib.suite.fails.join(", ")}.`
  }
  return s
}

function caption(lib) {
  const n = lib.adapters.length
  let s
  if (lib.source === "family") s = `${groupWord(lib, n)}, each in its own repo, all behind one interface.`
  // auth: README "Modules": the core needs the standard library and sqlb only; a
  // plugin with a third-party dependency (password, passkey, ...) is its own module.
  else if (lib.source === "plugins")
    s = `${groupWord(lib, n)}, in plugin/ and contrib/. A plugin with a third-party dependency is its own Go module, so you download only what you import. The tables live in your own Postgres, MySQL or SQLite.`
  else if (lib.source === "packages") s = `${groupWord(lib, n)} beside the core, each its own Go module, so you download only the backend you import.`
  else s = `${groupWord(lib, n)} under contrib/, each its own Go module, so you download only what you import.`
  if (lib.suite) {
    s += ` Marked ones pass ${lib.suite.name}.`
    if (lib.suite.note) s += ` ${lib.suite.note}`
  }
  return s
}

function init() {
  let libs
  try {
    libs = JSON.parse(dataEl.textContent)
  } catch (e) {
    return
  }
  if (!Array.isArray(libs) || !libs.length) return
  const svg = root.querySelector("[data-hero-svg]")
  const stage = root.querySelector("[data-hero-stage]")
  const titleEl = svg.querySelector("title")
  const descEl = svg.querySelector("desc")
  const cap = root.querySelector("[data-hero-caption]")
  const legend = root.querySelector("[data-hero-legend]")
  const legendFail = root.querySelector("[data-hero-legend-fail]")
  const pills = [...root.querySelectorAll("[data-hero-pill]")]
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)")
  const byName = Object.fromEntries(libs.map((l) => [l.name, l]))

  let current = libs[0]
  let width = 0
  let height = 0
  let token = 0
  let scene = null

  function size() {
    const cs = getComputedStyle(stage)
    width = Math.max(280, Math.floor(stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)))
    height = Math.ceil(Math.max(...libs.map((l) => layout(l, width).H)))
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`)
    svg.setAttribute("width", width)
    svg.setAttribute("height", height)
    svg.style.width = "100%"
    svg.style.height = "auto"
  }

  function build(lib, animate) {
    const L = layout(lib, width)
    // Keep <title>/<desc> as the first children; replace everything else.
    for (const c of [...svg.childNodes]) if (c !== titleEl && c !== descEl) c.remove()
    drawDefs(svg)
    el("rect", { width, height, fill: "url(#hd-dots)" }, svg)
    titleEl.textContent = `${lib.name}: core and ${groupWord(lib, lib.adapters.length)}`
    descEl.textContent = describe(lib, L)
    // Wide layouts are centered in the shared height; narrow ones sit at the top.
    const dy = L.narrow ? 0 : Math.round((height - L.H) / 2)
    const world = el("g", { transform: `translate(0,${dy})` }, svg)
    const wires = el("g", { class: "hd-wires" }, world)
    const core = el("g", { class: "hd-corewrap" }, world)
    const labels = el("g", { class: "hd-labels hd-fade" }, world)
    const nodes = el("g", { class: "hd-nodes" }, world)
    if (L.trunk) el("path", { d: L.trunk, class: "hd-wire" }, wires)
    const wireEls = []
    const flowEls = []
    L.nodes.forEach((n) => {
      const cls = n.status === "fail" ? " is-fail" : ""
      wireEls.push(el("path", { d: n.wire, class: `hd-wire hd-draw${cls}` }, wires))
      if (!n.more) flowEls.push(el("path", { d: n.wire, class: "hd-flow hd-fade" }, wires))
    })
    if (L.trunk) flowEls.push(el("path", { d: L.trunk, class: "hd-flow hd-fade" }, wires))
    drawCore(core, L, lib)
    drawLabels(labels, L, lib)
    const nodeEls = L.nodes.map((n, i) => drawNode(nodes, n, i, lib, L))
    cap.textContent = caption(lib)
    legend.hidden = !lib.suite
    legendFail.hidden = !(lib.suite && (lib.suite.fails || []).length)
    scene = { nodes, wires, labels }

    if (!animate || reduce.matches) {
      for (const n of nodeEls) n.classList.add("is-in")
      return
    }
    // Entering state: nodes collapsed onto the core, wires undrawn, flow hidden.
    labels.style.opacity = "0"
    nodeEls.forEach((a, i) => {
      const n = L.nodes[i]
      a.style.opacity = "0"
      a.style.transform = `translate(${L.cx - n.w / 2}px,${L.cy - n.h / 2}px) scale(.6)`
      a.style.transitionDelay = `${i * 0.03}s`
    })
    for (const w of wireEls) {
      const len = Math.ceil(w.getTotalLength())
      w.style.strokeDasharray = `${len} ${len}`
      w.style.strokeDashoffset = `${len}`
    }
    for (const f of flowEls) f.style.opacity = "0"
    svg.getBoundingClientRect() // flush styles so the transitions below run
    requestAnimationFrame(() => {
      labels.style.opacity = ""
      nodeEls.forEach((a, i) => {
        const n = L.nodes[i]
        a.style.opacity = ""
        a.style.transform = `translate(${n.x}px,${n.y}px)`
        a.classList.add("is-in")
      })
      wireEls.forEach((w, i) => {
        w.style.transitionDelay = `${0.12 + i * 0.03}s`
        w.style.strokeDashoffset = "0"
      })
      flowEls.forEach((f) => {
        f.style.transitionDelay = ".7s"
        f.style.opacity = ""
      })
    })
  }

  function select(name, opts = {}) {
    const lib = byName[name]
    if (!lib || (lib === current && !opts.force)) return
    current = lib
    for (const p of pills) p.setAttribute("aria-pressed", String(p.dataset.heroPill === name))
    const my = ++token
    if (!scene || reduce.matches) return build(lib, false)
    // Fade the old adapters out, then build the new ones.
    scene.nodes.style.transition = scene.wires.style.transition = scene.labels.style.transition = "opacity .14s ease"
    scene.nodes.style.opacity = scene.wires.style.opacity = scene.labels.style.opacity = "0"
    setTimeout(() => {
      if (my === token) build(lib, true)
    }, 140)
  }

  for (const p of pills) {
    let hoverTimer = 0
    p.addEventListener("click", () => select(p.dataset.heroPill))
    p.addEventListener("focus", () => select(p.dataset.heroPill))
    p.addEventListener("mouseenter", () => {
      clearTimeout(hoverTimer)
      hoverTimer = setTimeout(() => select(p.dataset.heroPill), 90)
    })
    p.addEventListener("mouseleave", () => clearTimeout(hoverTimer))
  }
  // Arrow keys move between pills, like a toolbar.
  root.querySelector('[role="group"]').addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return
    const i = pills.indexOf(document.activeElement)
    if (i < 0) return
    e.preventDefault()
    pills[(i + (e.key === "ArrowRight" ? 1 : pills.length - 1)) % pills.length].focus()
  })

  size()
  build(current, true)
  const ro = new ResizeObserver(() => {
    const before = width
    size()
    if (width !== before) build(current, false)
  })
  ro.observe(stage)
}

// Called last so every module-level constant above is initialised first.
if (root && dataEl) init()
