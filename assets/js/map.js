// /map/: every public library as one SVG graph, grouped by area, with only real
// edges (see the comment at the top of layouts/map.html for where each comes from).
//
// Two layouts, both computed here and deterministic for a given width:
//   wide  (stage >= 640px) area clusters packed on a grid in a pan/zoom world;
//         inside a cluster each connected family is laid out on its own (a hub
//         ring when one library has 4+ neighbours, else a small tree), and lone
//         libraries fill rows.
//   phone (< 640px) clusters stacked in one column at full width, no pan/zoom;
//         edges show only for the tapped library; a second tap opens its page.

const root = document.querySelector("[data-map]")
const dataEl = document.getElementById("map-data")

const NS = "http://www.w3.org/2000/svg"
/** Stage width below which the stacked phone layout is used. */
const PHONE = 640
/** JetBrains Mono advance is 0.6em; node width follows from the name length. */
const CHAR = 12 * 0.6
const NODE_H = 26
const MIN_K = 0.25
const MAX_K = 3
/** Edge types in legend order; the CSS classes and marker ids derive from these. */
const TYPES = ["family", "examples", "depends", "interop", "replaced"]

function el(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag)
  if (attrs) for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) n.setAttribute(k, attrs[k])
  if (parent) parent.appendChild(n)
  return n
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c])
}

// ---- graph --------------------------------------------------------------

function buildEdges(nodes, byName) {
  const edges = []
  const seen = new Map()
  function add(from, to, type, label) {
    if (!byName[from] || !byName[to] || from === to) return
    const [a, b] = type === "interop" ? [from, to].sort() : [from, to]
    const key = `${type}:${a}>${b}`
    const prev = seen.get(key)
    if (prev) {
      if (label && !prev.labels.includes(label)) prev.labels.push(label)
      return
    }
    const e = { from: a, to: b, type, labels: label ? [label] : [] }
    seen.set(key, e)
    edges.push(e)
  }
  for (const n of nodes) {
    if (n.family) add(n.name, n.family, n.kind === "examples" ? "examples" : "family")
    if (n.examplesRepo) add(n.examplesRepo, n.name, "examples")
    if (n.interop) add(n.name, n.interop, "interop")
    if (n.replacedBy) add(n.name, n.replacedBy, "replaced")
    for (const d of n.deps || []) add(n.name, d.name, "depends", d.from && d.from !== "." ? d.from : "")
  }
  // A family member or examples repo almost always also requires its library in
  // go.mod. Drawing both would double every spoke, so the go.mod fact is folded
  // into the family/examples edge (e.goMod) and still listed in the side panel.
  return edges.filter((e) => {
    if (e.type !== "depends") return true
    const twin = edges.find((x) => (x.type === "family" || x.type === "examples") && x.from === e.from && x.to === e.to)
    if (!twin) return true
    twin.goMod = e.labels.length ? e.labels : [""]
    return false
  })
}

function nodeSize(n) {
  const tag = n.lang === "TypeScript" ? 22 : 0
  return { w: Math.ceil(n.name.length * CHAR) + 22 + tag, h: NODE_H }
}

// ---- layout: wide -------------------------------------------------------

function overlaps(a, b, m) {
  return Math.abs(a.x - b.x) * 2 < a.w + b.w + 2 * m && Math.abs(a.y - b.y) * 2 < a.h + b.h + 2 * m
}

/** Lay out one connected component; returns nodes with center x/y relative to its own box and the box size. */
function layoutComponent(names, nodesBy, adj) {
  const items = names.map((name) => ({ name, ...nodeSize(nodesBy[name]) }))
  if (items.length === 1) {
    items[0].x = items[0].w / 2
    items[0].y = items[0].h / 2
    return { items, w: items[0].w, h: items[0].h }
  }
  const set = new Set(names)
  const deg = (n) => [...(adj[n] || [])].filter((m) => set.has(m)).length
  // Hub: most neighbours inside the component, ties to the earliest in data order.
  const hub = names.reduce((best, n) => (deg(n) > deg(best) ? n : best), names[0])
  const byN = Object.fromEntries(items.map((i) => [i.name, i]))
  if (deg(hub) >= 4 && items.length >= 5) {
    const h = byN[hub]
    const ring = items.filter((i) => i !== h)
    h.x = 0
    h.y = 0
    let rx = Math.max(...ring.map((i) => i.w)) / 2 + h.w / 2 + 34
    let ry = 62
    for (let tries = 0; tries < 60; tries++) {
      ring.forEach((it, i) => {
        const t = -Math.PI / 2 + (i * 2 * Math.PI) / ring.length
        it.x = Math.round(rx * Math.cos(t))
        it.y = Math.round(ry * Math.sin(t))
      })
      const all = [h, ...ring]
      let bad = false
      for (let i = 0; i < all.length && !bad; i++) for (let j = i + 1; j < all.length; j++) if (overlaps(all[i], all[j], 7)) { bad = true; break }
      if (!bad) break
      rx *= 1.06
      ry *= 1.09
    }
    return normalize(items)
  }
  // Small tree: BFS layers from the hub, one row per layer, centered.
  const layers = [[hub]]
  const placed = new Set([hub])
  while (placed.size < names.length) {
    const next = []
    for (const n of layers[layers.length - 1]) for (const m of names) if (!placed.has(m) && adj[n]?.has(m)) { placed.add(m); next.push(m) }
    if (!next.length) for (const m of names) if (!placed.has(m)) { placed.add(m); next.push(m); break }
    layers.push(next)
  }
  layers.forEach((layer, li) => {
    const row = layer.map((n) => byN[n])
    const total = row.reduce((s, i) => s + i.w, 0) + 14 * (row.length - 1)
    let x = -total / 2
    for (const it of row) {
      it.x = x + it.w / 2
      it.y = li * (NODE_H + 30)
      x += it.w + 14
    }
  })
  return normalize(items)
}

function normalize(items) {
  const minX = Math.min(...items.map((i) => i.x - i.w / 2))
  const minY = Math.min(...items.map((i) => i.y - i.h / 2))
  for (const i of items) {
    i.x -= minX
    i.y -= minY
  }
  return { items, w: Math.max(...items.map((i) => i.x + i.w / 2)), h: Math.max(...items.map((i) => i.y + i.h / 2)) }
}

/** Shelf-pack boxes ({w,h}) into rows no wider than maxW; sets .x/.y, returns size. */
function shelf(boxes, maxW, gx, gy) {
  let x = 0
  let y = 0
  let rowH = 0
  let w = 0
  for (const b of boxes) {
    if (x > 0 && x + b.w > maxW) {
      x = 0
      y += rowH + gy
      rowH = 0
    }
    b.x = x
    b.y = y
    x += b.w + gx
    rowH = Math.max(rowH, b.h)
    w = Math.max(w, x - gx)
  }
  return { w, h: y + rowH }
}

function layoutWide(model, aspect) {
  const { nodes, areas, adjIntra } = model
  const nodesBy = model.byName
  const PAD = 18
  const HEAD = 30
  const clusters = []
  for (const a of areas) {
    const names = nodes.filter((n) => n.area === a.key).map((n) => n.name)
    if (!names.length) continue
    // Connected components over edges that stay inside this area.
    const comp = []
    const seen = new Set()
    for (const n of names) {
      if (seen.has(n)) continue
      const stack = [n]
      const c = []
      seen.add(n)
      while (stack.length) {
        const m = stack.pop()
        c.push(m)
        for (const k of adjIntra[m] || []) if (!seen.has(k) && names.includes(k)) { seen.add(k); stack.push(k) }
      }
      c.sort((p, q) => names.indexOf(p) - names.indexOf(q))
      comp.push(c)
    }
    comp.sort((p, q) => q.length - p.length || names.indexOf(p[0]) - names.indexOf(q[0]))
    const boxes = comp.map((c) => layoutComponent(c, nodesBy, adjIntra))
    const widest = Math.max(...boxes.map((b) => b.w))
    const inner = shelf(boxes, Math.max(widest, 330), 22, 22)
    clusters.push({ area: a, boxes, w: Math.max(inner.w, a.title.length * 8 + 40) + 2 * PAD, h: inner.h + PAD + HEAD, innerW: inner.w })
  }
  // Masonry: each area goes to the shortest column, in data order. The column
  // count is the one that would be drawn largest on a stage of shape ASPECT.
  // Then every cluster is stretched to its column's width, and each column's
  // spare height is shared out, so the areas read as a tidy grid.
  const G = 26
  const ASPECT = aspect || 1.7
  let best = null
  for (let n = 2; n <= 5; n++) {
    const cols = Array.from({ length: n }, () => ({ h: -G, w: 0, items: [] }))
    for (const c of clusters) {
      const col = cols.reduce((m, x) => (x.h < m.h ? x : m), cols[0])
      col.items.push(c)
      col.h += G + c.h
      col.w = Math.max(col.w, c.w)
    }
    const W = cols.reduce((sum, x) => sum + x.w, 0) + G * (n - 1)
    const H = Math.max(...cols.map((x) => x.h))
    // Fit scale this shape would get on a stage of that aspect: bigger is better.
    // A small nudge toward more columns: at a near tie the wider grid fills the
    // stage instead of leaving empty bands at the sides.
    const score = Math.min(ASPECT / W, 1 / H) * (1 + 0.05 * (n - 2))
    if (!best || score > best.score) best = { score, cols, W, H }
  }
  let x = 0
  for (const col of best.cols) {
    const spare = (best.H - col.h) / col.items.length
    let y = 0
    for (const c of col.items) {
      c.offX = (col.w - 2 * PAD - c.innerW) / 2
      c.offY = spare / 2
      c.x = x
      c.y = y
      c.w = col.w
      c.h += spare
      y += c.h + G
    }
    x += col.w + G
  }
  const fullW = best.W
  const y = best.H + G
  const pos = {}
  for (const c of clusters) {
    for (const b of c.boxes) for (const it of b.items) {
      pos[it.name] = { x: c.x + PAD + c.offX + b.x + it.x, y: c.y + HEAD + PAD / 2 + c.offY + b.y + it.y, w: it.w, h: it.h }
    }
  }
  return { pos, clusters: clusters.map((c) => ({ key: c.area.key, title: c.area.title, x: c.x, y: c.y, w: c.w, h: c.h })), w: fullW, h: y - G }
}

// ---- layout: phone ------------------------------------------------------

function layoutPhone(model, W) {
  const PAD = 12
  const HEAD = 30
  const pos = {}
  const clusters = []
  let y = 0
  for (const a of model.areas) {
    const list = model.nodes.filter((n) => n.area === a.key)
    if (!list.length) continue
    const boxes = list.map((n) => ({ name: n.name, ...nodeSize(n) }))
    const inner = shelf(boxes, W - 2 * PAD, 8, 8)
    for (const b of boxes) pos[b.name] = { x: PAD + b.x + b.w / 2, y: y + HEAD + b.y + b.h / 2, w: b.w, h: b.h }
    const h = HEAD + inner.h + PAD
    clusters.push({ key: a.key, title: a.title, x: 0, y, w: W, h })
    y += h + 12
  }
  return { pos, clusters, w: W, h: y - 12 }
}

// ---- edge geometry ------------------------------------------------------

/** Where the ray from a rect's center toward (tx,ty) leaves the rect, pushed out by m. */
function exitPoint(r, tx, ty, m) {
  const dx = tx - r.x
  const dy = ty - r.y
  const hw = r.w / 2 + m
  const hh = r.h / 2 + m
  const t = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity)
  return { x: r.x + dx * t, y: r.y + dy * t }
}

function edgePath(a, b, bend) {
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const cx = mx - (dy / len) * bend
  const cy = my + (dx / len) * bend
  const p0 = exitPoint(a, cx, cy, 2)
  const p1 = exitPoint(b, cx, cy, 4)
  return {
    d: `M${p0.x.toFixed(1)},${p0.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`,
    mid: { x: 0.25 * p0.x + 0.5 * cx + 0.25 * p1.x, y: 0.25 * p0.y + 0.5 * cy + 0.25 * p1.y },
  }
}

// ---- relations text for the side panel ------------------------------------

function relations(name, edges) {
  const groups = new Map()
  const push = (label, other, note) => {
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label).push({ other, note })
  }
  for (const e of edges) {
    const out = e.from === name
    if (!out && e.to !== name) continue
    const other = out ? e.to : e.from
    const note = e.labels.length ? e.labels.join(", ") : ""
    const goNote = e.goMod ? `go.mod${e.goMod[0] ? ` (${e.goMod.join(", ")})` : ""}` : ""
    if (e.type === "family") push(out ? "Part of the family" : "Family members", other, goNote)
    else if (e.type === "examples") push(out ? "Examples for" : "Examples in", other, goNote)
    else if (e.type === "depends") push(out ? "Requires (go.mod)" : "Required by", other, note)
    else if (e.type === "interop") push("Byte-compatible with", other)
    else if (e.type === "replaced") push(out ? "Replaced by" : "Replaces", other)
  }
  return groups
}

// ---- main ---------------------------------------------------------------

function init() {
  let data
  try {
    data = JSON.parse(dataEl.textContent)
  } catch (e) {
    return
  }
  const base = root.dataset.base || "/libraries/"
  const href = (name) => `${base}${name}/`
  const nodes = data.nodes
  const areas = data.areas
  const byName = Object.fromEntries(nodes.map((n) => [n.name, n]))
  const areaTitle = Object.fromEntries(areas.map((a) => [a.key, a.title]))
  const edges = buildEdges(nodes, byName)
  const adj = {}
  const adjIntra = {}
  for (const e of edges) {
    ;(adj[e.from] ||= new Set()).add(e.to)
    ;(adj[e.to] ||= new Set()).add(e.from)
    if (byName[e.from].area === byName[e.to].area) {
      ;(adjIntra[e.from] ||= new Set()).add(e.to)
      ;(adjIntra[e.to] ||= new Set()).add(e.from)
    }
  }
  const model = { nodes, areas, byName, adjIntra }

  const stage = root.querySelector("[data-map-stage]")
  const svg = root.querySelector("[data-map-svg]")
  const panel = root.querySelector("[data-map-panel]")
  const scaleEl = root.querySelector("[data-map-scale]")
  const countEl = document.querySelector("[data-map-count]")
  const input = document.getElementById("map-q")
  const chips = [...document.querySelectorAll("[data-map-area]")]
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)")

  let phone = false
  let L = null
  let world = null
  let view = { tx: 0, ty: 0, k: 1 }
  let vw = 0
  let vh = 0
  let touched = false // user has panned/zoomed; resize then keeps their view
  const nodeEls = {}
  let edgeEls = []
  let active = "" // highlighted library
  let area = ""
  let words = []

  // ---- render ----
  function render() {
    const w = stage.clientWidth
    phone = w < PHONE
    L = phone ? layoutPhone(model, w) : layoutWide(model, w / Math.max(1, stage.clientHeight))
    for (const c of [...svg.childNodes]) if (c.nodeName !== "title") c.remove()
    svg.classList.toggle("is-phone", phone)
    const defs = el("defs", null, svg)
    const pat = el("pattern", { id: "mp-dots", width: 18, height: 18, patternUnits: "userSpaceOnUse" }, defs)
    el("circle", { cx: 1, cy: 1, r: 1, class: "mp-dots" }, pat)
    for (const t of TYPES) {
      const mk = el("marker", { id: `mk-${t}`, viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, markerUnits: "userSpaceOnUse", orient: "auto-start-reverse" }, defs)
      el("path", { d: "M0,1 L10,5 L0,9 z", class: `mk-${t}` }, mk)
    }
    el("rect", { width: "100%", height: "100%", fill: "url(#mp-dots)" }, svg)
    world = el("g", { class: "mp-world" }, svg)
    const gc = el("g", null, world)
    const ge = el("g", null, world)
    const gl = el("g", null, world)
    const gn = el("g", null, world)
    for (const c of L.clusters) {
      const g = el("g", { class: "mp-cluster", "data-area": c.key }, gc)
      el("rect", { x: c.x, y: c.y, width: c.w, height: c.h, rx: 14 }, g)
      const t = el("text", { x: c.x + 14, y: c.y + 20 }, g)
      t.textContent = c.title + " "
      const n = nodes.filter((x) => x.area === c.key).length
      el("tspan", null, t).textContent = ` ${n}`
    }
    // Parallel edges between the same pair fan out.
    const pairCount = new Map()
    const pairIdx = new Map()
    for (const e of edges) {
      const k = [e.from, e.to].sort().join("|")
      pairCount.set(k, (pairCount.get(k) || 0) + 1)
    }
    edgeEls = edges.map((e) => {
      const k = [e.from, e.to].sort().join("|")
      const i = pairIdx.get(k) || 0
      pairIdx.set(k, i + 1)
      const m = pairCount.get(k)
      const a = L.pos[e.from]
      const b = L.pos[e.to]
      const dist = Math.hypot(b.x - a.x, b.y - a.y)
      const curved = e.type === "depends" || e.type === "examples"
      const sign = e.from < e.to ? 1 : -1
      let bend = (curved ? Math.min(60, dist * 0.16) : 0) + (i - (m - 1) / 2) * 16 * sign
      if (phone) bend = Math.min(90, dist * 0.35) * (a.x <= b.x ? 1 : -1)
      const p = edgePath(a, b, bend)
      const path = el("path", { d: p.d, class: `mp-edge mp-e-${e.type}`, "marker-end": `url(#mk-${e.type})`, "marker-start": e.type === "interop" ? `url(#mk-${e.type})` : null }, ge)
      let label = null
      if (e.labels.length) {
        label = el("text", { x: p.mid.x, y: p.mid.y + 3, "text-anchor": "middle", class: "mp-elabel" }, gl)
        label.textContent = e.labels.join(", ")
      }
      return { e, path, label }
    })
    for (const n of nodes) {
      const p = L.pos[n.name]
      const a = el("a", { href: href(n.name), class: `mp-node k-${n.kind}${n.featured ? " is-featured" : ""}`, "data-name": n.name, "aria-label": `${n.name}, ${areaTitle[n.area]}: ${n.summary}` }, gn)
      el("rect", { class: "mp-pill", x: p.x - p.w / 2, y: p.y - p.h / 2, width: p.w, height: p.h, rx: 7 }, a)
      const t = el("text", { x: p.x - p.w / 2 + 11, y: p.y + 4.2, class: "mp-label" }, a)
      t.textContent = n.name
      if (n.lang === "TypeScript") {
        const tag = el("text", { x: p.x + p.w / 2 - 9, y: p.y + 3.4, "text-anchor": "end", class: "mp-tag" }, a)
        tag.textContent = "TS"
      }
      nodeEls[n.name] = a
    }
    if (phone) {
      svg.setAttribute("viewBox", `0 0 ${L.w} ${L.h}`)
      svg.setAttribute("height", L.h)
      svg.style.height = `${L.h}px`
    } else {
      svg.removeAttribute("height")
      svg.style.height = ""
      resizeView()
      if (!touched) fit(false)
      else apply(false)
    }
    paint()
  }

  // ---- view (wide only) ----
  function resizeView() {
    vw = stage.clientWidth
    vh = stage.clientHeight
    svg.setAttribute("viewBox", `0 0 ${vw} ${vh}`)
  }
  function apply(glide) {
    if (!world || phone) return
    world.classList.toggle("is-glide", !!glide && !reduce.matches)
    world.setAttribute("transform", `translate(${view.tx.toFixed(2)},${view.ty.toFixed(2)}) scale(${view.k.toFixed(4)})`)
    if (scaleEl) scaleEl.textContent = `${Math.round(view.k * 100)}%`
  }
  function fitBox(x, y, w, h, glide, maxK = 1.6) {
    const m = 24
    const k = Math.max(MIN_K, Math.min(maxK, (vw - 2 * m) / w, (vh - 2 * m) / h))
    view = { k, tx: (vw - w * k) / 2 - x * k, ty: (vh - h * k) / 2 - y * k }
    apply(glide)
  }
  function fit(glide) {
    fitBox(0, 0, L.w, L.h, glide, 1.2)
  }
  function zoomAt(px, py, factor, glide) {
    const k = Math.max(MIN_K, Math.min(MAX_K, view.k * factor))
    const f = k / view.k
    view = { k, tx: px - (px - view.tx) * f, ty: py - (py - view.ty) * f }
    touched = true
    apply(glide)
  }
  function boundsOf(names) {
    const ps = names.map((n) => L.pos[n])
    const x0 = Math.min(...ps.map((p) => p.x - p.w / 2))
    const y0 = Math.min(...ps.map((p) => p.y - p.h / 2))
    const x1 = Math.max(...ps.map((p) => p.x + p.w / 2))
    const y1 = Math.max(...ps.map((p) => p.y + p.h / 2))
    return [x0 - 30, y0 - 40, x1 - x0 + 60, y1 - y0 + 70]
  }

  // ---- highlight / filter ----
  function filtered() {
    if (!area && !words.length) return null
    return new Set(nodes.filter((n) => (!area || n.area === area) && words.every((w) => `${n.name} ${n.summary}`.toLowerCase().includes(w))).map((n) => n.name))
  }
  function paint() {
    const f = filtered()
    svg.classList.toggle("is-filter", !!f)
    svg.classList.toggle("is-focus", !!active)
    const lit = new Set()
    if (active) {
      lit.add(active)
      for (const m of adj[active] || []) lit.add(m)
    }
    for (const n of nodes) {
      const a = nodeEls[n.name]
      a.classList.toggle("is-active", n.name === active)
      a.classList.toggle("is-match", !!f && words.length > 0 && f.has(n.name))
      a.classList.toggle("is-lit", active ? lit.has(n.name) : !!f && f.has(n.name))
    }
    for (const { e, path, label } of edgeEls) {
      const on = active ? e.from === active || e.to === active : !!f && (f.has(e.from) || f.has(e.to)) && !(words.length && !(f.has(e.from) && f.has(e.to)))
      path.classList.toggle("is-lit", on)
      if (label) label.classList.toggle("is-lit", !!active && on)
    }
    for (const c of svg.querySelectorAll(".mp-cluster")) c.classList.toggle("is-lit", !!f && [...f].some((n) => byName[n].area === c.dataset.area))
    if (countEl) countEl.textContent = f ? `${f.size} of ${nodes.length}` : `${nodes.length} libraries · ${edges.length} links`
  }

  function showPanel(name) {
    const n = byName[name]
    root.classList.toggle("has-panel", !!n)
    if (!n) {
      panel.classList.add("hidden")
      panel.innerHTML = ""
      return
    }
    const groups = relations(name, edges)
    let rel = ""
    for (const [label, list] of groups) {
      // When every link in a group is also a plain go.mod require, say it once.
      const allGo = list.every((r) => r.note === "go.mod")
      const sub = allGo ? ` <span class="normal-case tracking-normal text-slate-400 dark:text-slate-500">· also in go.mod</span>` : ""
      if (allGo) for (const r of list) r.note = ""
      rel += `<div class="mt-2"><div class="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">${esc(label)}${sub}</div><ul class="mt-0.5 flex flex-wrap gap-1">`
      for (const r of list) rel += `<li><a href="${esc(href(r.other))}" data-map-rel="${esc(r.other)}" class="inline-flex items-center gap-1 h-6 px-1.5 rounded border border-slate-200 dark:border-slate-700 font-mono text-[11.5px] text-slate-700 dark:text-slate-200 hover:border-brand-500 hover:text-brand-700 dark:hover:text-brand-400">${esc(r.other)}${r.note ? `<span class="text-slate-400 dark:text-slate-500">${esc(r.note)}</span>` : ""}</a></li>`
      rel += "</ul></div>"
    }
    if (!rel) rel = `<p class="mt-2 text-[12px] text-slate-500 dark:text-slate-400">No links to other ubgo libraries.</p>`
    const kind = n.kind !== "library" ? `<span class="inline-flex items-center h-5 px-1.5 rounded text-[11px] font-medium ${n.kind === "deprecated" ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}">${esc(n.kind)}</span>` : ""
    const meta = [areaTitle[n.area], n.lang, n.license].filter(Boolean).map(esc).join(" · ")
    panel.innerHTML = `<div class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-lg shadow-slate-900/5 p-3">
      <div class="flex items-start gap-2"><div class="min-w-0 mr-auto"><div class="flex flex-wrap items-center gap-1.5"><span class="font-mono font-semibold text-[14px] text-slate-900 dark:text-white">${esc(n.name)}</span>${kind}</div>
      <div class="mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">${meta}</div></div>
      <button type="button" data-map-close class="shrink-0 size-6 inline-flex items-center justify-center rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-slate-800" aria-label="Close"><svg class="size-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8"/></svg></button></div>
      <p class="mt-1.5 text-[12.5px] leading-snug text-slate-700 dark:text-slate-300">${esc(n.summary)}</p>
      ${rel}
      <a href="${esc(href(n.name))}" class="mt-3 h-7 px-2.5 inline-flex items-center gap-1 rounded-md bg-brand-600 text-white text-[12.5px] font-medium hover:bg-brand-700">Open ${esc(n.name)} <span aria-hidden="true">→</span></a>
    </div>`
    panel.classList.remove("hidden")
  }

  function focusNode(name) {
    if (active === name) return
    active = name
    // Desktop: dock the panel on the side away from the library so it never hides it.
    if (!phone && L.pos[name]) {
      const sx = L.pos[name].x * view.k + view.tx
      const left = sx > vw * 0.55
      panel.style.left = left ? ".5rem" : "auto"
      panel.style.right = left ? "auto" : ".5rem"
    } else {
      panel.style.left = panel.style.right = ""
    }
    paint()
    showPanel(name)
  }
  function clearFocus() {
    active = ""
    armed = ""
    paint()
    showPanel("")
  }

  // ---- node events ----
  let leaveTimer = 0
  svg.addEventListener("mouseover", (e) => {
    const a = e.target.closest?.(".mp-node")
    if (!a || phone) return
    clearTimeout(leaveTimer)
    focusNode(a.dataset.name)
  })
  svg.addEventListener("mouseout", (e) => {
    const a = e.target.closest?.(".mp-node")
    if (!a || phone) return
    if (e.relatedTarget && a.contains(e.relatedTarget)) return
    clearTimeout(leaveTimer)
    leaveTimer = setTimeout(() => {
      if (!panel.matches(":hover")) clearFocus()
    }, 450)
  })
  panel.addEventListener("mouseleave", () => {
    if (phone || !active) return
    leaveTimer = setTimeout(() => {
      if (!svg.querySelector(".mp-node:hover")) clearFocus()
    }, 300)
  })
  panel.addEventListener("mouseenter", () => clearTimeout(leaveTimer))
  panel.addEventListener("mouseout", (e) => {
    if (!e.relatedTarget || !panel.contains(e.relatedTarget)) for (const a of svg.querySelectorAll(".mp-node.is-peek")) a.classList.remove("is-peek")
  })
  svg.addEventListener("focusin", (e) => {
    const a = e.target.closest?.(".mp-node")
    // Phone: a tap also focuses the link; highlighting here would open the panel
    // under the finger before the click lands, so taps go through the click handler.
    if (!a || phone) return
    focusNode(a.dataset.name)
    // Keep the focused node on screen when tabbing through a zoomed-in map.
    if (!phone) {
      const p = L.pos[a.dataset.name]
      const sx = p.x * view.k + view.tx
      const sy = p.y * view.k + view.ty
      if (sx < 40 || sy < 40 || sx > vw - 40 || sy > vh - 40) {
        view.tx += vw / 2 - sx
        view.ty += vh / 2 - sy
        apply(true)
      }
    }
  })
  panel.addEventListener("click", (e) => {
    if (e.target.closest("[data-map-close]")) {
      clearFocus()
      return
    }
  })
  panel.addEventListener("mouseover", (e) => {
    const r = e.target.closest?.("[data-map-rel]")
    for (const a of svg.querySelectorAll(".mp-node.is-peek")) a.classList.remove("is-peek")
    if (r && nodeEls[r.dataset.mapRel]) nodeEls[r.dataset.mapRel].classList.add("is-peek")
  })

  // Clicks: suppressed after a drag; on phone the first tap highlights.
  let dragged = false
  let armed = ""
  svg.addEventListener("click", (e) => {
    if (dragged) {
      e.preventDefault()
      e.stopPropagation()
      dragged = false
      return
    }
    const a = e.target.closest(".mp-node")
    if (!a) {
      if (active) clearFocus()
      return
    }
    // Phone: the first tap arms and highlights, the second opens. Tracked apart
    // from `active`, because the tap's focusin has already highlighted the node.
    if (phone && armed !== a.dataset.name) {
      e.preventDefault()
      armed = a.dataset.name
      focusNode(a.dataset.name)
      // Keep the tapped library above the panel docked at the bottom of the screen.
      requestAnimationFrame(() => {
        const r = a.getBoundingClientRect()
        const limit = window.innerHeight - panel.getBoundingClientRect().height - 16
        if (r.bottom > limit) window.scrollBy({ top: r.bottom - limit, behavior: reduce.matches ? "auto" : "smooth" })
      })
    }
  }, true)

  // ---- pan / zoom (wide only) ----
  const pointers = new Map()
  let start = null
  let pinch = null
  function local(e) {
    const r = svg.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  stage.addEventListener("pointerdown", (e) => {
    if (phone || e.target.closest("[data-map-zoom], [data-map-panel]")) return
    if (e.pointerType === "mouse" && e.button !== 0) return
    pointers.set(e.pointerId, local(e))
    dragged = false
    if (pointers.size === 1) start = { ...local(e), tx: view.tx, ty: view.ty, id: e.pointerId }
    if (pointers.size === 2) {
      const [p, q] = [...pointers.values()]
      pinch = { d: Math.hypot(p.x - q.x, p.y - q.y), k: view.k, mx: (p.x + q.x) / 2, my: (p.y + q.y) / 2, tx: view.tx, ty: view.ty }
      stage.setPointerCapture(e.pointerId)
    }
  })
  stage.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return
    const p = local(e)
    pointers.set(e.pointerId, p)
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      const k = Math.max(MIN_K, Math.min(MAX_K, (pinch.k * d) / pinch.d))
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2
      const f = k / pinch.k
      view = { k, tx: mx - (pinch.mx - pinch.tx) * f, ty: my - (pinch.my - pinch.ty) * f }
      touched = dragged = true
      apply(false)
      return
    }
    if (!start || start.id !== e.pointerId) return
    const dx = p.x - start.x
    const dy = p.y - start.y
    if (!dragged && Math.hypot(dx, dy) < 5) return
    if (!dragged) {
      dragged = true
      stage.setPointerCapture(e.pointerId)
      stage.classList.add("is-panning")
    }
    view.tx = start.tx + dx
    view.ty = start.ty + dy
    touched = true
    apply(false)
  })
  function up(e) {
    pointers.delete(e.pointerId)
    if (pointers.size < 2) pinch = null
    if (!pointers.size) {
      start = null
      stage.classList.remove("is-panning")
      // A click event follows pointerup only on the same target; clear the flag
      // shortly after so a drag that ends off a node does not eat the next click.
      if (dragged) setTimeout(() => { dragged = false }, 0)
    }
  }
  stage.addEventListener("pointerup", up)
  stage.addEventListener("pointercancel", up)
  stage.addEventListener("wheel", (e) => {
    if (phone) return
    e.preventDefault()
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? vh : 1
    const dy = e.deltaY * unit
    // Trackpad pinch arrives as a wheel event with ctrlKey; it needs a stronger factor.
    const factor = Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018))
    const p = local(e)
    zoomAt(p.x, p.y, factor, false)
  }, { passive: false })
  for (const b of root.querySelectorAll("[data-zoom]")) {
    b.addEventListener("click", () => {
      if (b.dataset.zoom === "reset") {
        touched = false
        return fit(true)
      }
      zoomAt(vw / 2, vh / 2, b.dataset.zoom === "in" ? 1.3 : 1 / 1.3, true)
    })
  }

  // ---- toolbar ----
  function zoomToFilter() {
    const f = filtered()
    if (phone) {
      if (area) {
        const c = L.clusters.find((x) => x.key === area)
        if (c) window.scrollTo({ top: svg.getBoundingClientRect().top + window.scrollY + c.y - 120, behavior: reduce.matches ? "auto" : "smooth" })
      }
      return
    }
    if (!f || !f.size) {
      touched = false
      return fit(true)
    }
    touched = true
    fitBox(...boundsOf([...f]), true)
  }
  input.addEventListener("input", () => {
    words = input.value.toLowerCase().split(/\s+/).filter(Boolean)
    if (active) clearFocus()
    paint()
  })
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault()
      zoomToFilter()
      const f = filtered()
      if (f && f.size === 1) nodeEls[[...f][0]].focus()
    }
    if (e.key === "Escape") {
      input.value = ""
      words = []
      paint()
      zoomToFilter()
    }
  })
  for (const c of chips) {
    c.addEventListener("click", () => {
      area = c.dataset.mapArea
      for (const x of chips) x.setAttribute("aria-pressed", String(x === c))
      if (active) clearFocus()
      paint()
      zoomToFilter()
    })
  }
  document.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key === "Escape" && active) return clearFocus()
    if (typing) return
    if (e.key === "/") {
      e.preventDefault()
      input.focus()
    } else if (!phone && (e.key === "+" || e.key === "=")) zoomAt(vw / 2, vh / 2, 1.3, true)
    else if (!phone && e.key === "-") zoomAt(vw / 2, vh / 2, 1 / 1.3, true)
    else if (!phone && e.key === "0") {
      touched = false
      fit(true)
    }
  })

  render()
  let lastW = stage.clientWidth
  let lastH = stage.clientHeight
  new ResizeObserver(() => {
    const w = stage.clientWidth
    const h = stage.clientHeight
    if (w === lastW && h === lastH) return
    const crossed = (w < PHONE) !== (lastW < PHONE)
    const widthChanged = w !== lastW
    lastW = w
    lastH = h
    if (crossed || (phone && widthChanged)) render()
    else if (!phone) {
      // The cluster grid follows the stage's shape, so re-lay it out unless the
      // reader has already panned or zoomed (then just keep their view).
      if (!touched) render()
      else resizeView()
    }
  }).observe(stage)
}

// Called last so every module-level constant above is initialised first.
if (root && dataEl) init()
