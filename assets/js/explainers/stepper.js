// Shared engine for the step-through explainer diagrams.
//
// A page holds <figure data-explainer="<key>"> (see layouts/explainers/page.html) with a
// stage, a caption, controls and an <ol data-xp-steps> whose <li> items are the step
// captions from the explainer's front matter. A module registers a definition:
//
//   { build(stage, { preview }) -> api, apply(api, step, { animate, preview }), preview: stepIndex }
//
// On the explainers index each card calls build with preview: true and applies the
// preview step once, without controls; a module may draw a simpler picture there.
//
// build() draws the SVG once; apply() must set the WHOLE diagram state for a step from
// scratch (never "the change since the previous step"), so Prev, Reset and jumping to
// any step all land on the same picture. Motion comes from CSS transitions on the
// elements apply() touches; with reduced motion or a jump we switch them off.

const STYLE_ID = "xp-style"
const DWELL_MS = 3200 // how long Play shows each step; long enough to read a two-sentence caption

// One small design system for every diagram: colors as custom properties (light and
// dark), and state classes (.is-active / .is-ok / .is-err / .is-warn / .is-dim) that
// modules toggle. Kept here rather than in main.css so the explainers stay one folder.
const CSS = `
[data-explainer],[data-explainer-preview]{
  --xp-bg:#f8fafc;--xp-grid:#e2e8f0;--xp-surface:#ffffff;--xp-line:#cbd5e1;--xp-text:#0f172a;--xp-muted:#64748b;
  --xp-brand:#0891b2;--xp-brand-soft:#ecfeff;--xp-ok:#059669;--xp-ok-soft:#ecfdf5;--xp-err:#e11d48;--xp-err-soft:#fff1f2;
  --xp-warn:#d97706;--xp-warn-soft:#fffbeb;--xp-shadow:rgba(15,23,42,.06)}
.dark [data-explainer],.dark [data-explainer-preview]{
  --xp-bg:#0d1526;--xp-grid:#18233a;--xp-surface:#111b2f;--xp-line:#334155;--xp-text:#e2e8f0;--xp-muted:#94a3b8;
  --xp-brand:#22d3ee;--xp-brand-soft:rgba(34,211,238,.12);--xp-ok:#34d399;--xp-ok-soft:rgba(52,211,153,.13);--xp-err:#fb7185;--xp-err-soft:rgba(251,113,133,.13);
  --xp-warn:#fbbf24;--xp-warn-soft:rgba(251,191,36,.13);--xp-shadow:rgba(0,0,0,.35)}
[data-xp-stage],[data-explainer-preview]{background-color:var(--xp-bg);background-image:radial-gradient(var(--xp-grid) 1.1px,transparent 1.2px);background-size:20px 20px;background-position:10px 10px}
[data-explainer-preview]{display:flex;align-items:center;justify-content:center}
.xp-svg{display:block;width:100%;max-width:620px;margin:0 auto;height:auto;font-family:Inter,ui-sans-serif,system-ui,sans-serif}
.xp-svg text{fill:var(--xp-text);font-size:14px}
.xp-svg .xp-m{fill:var(--xp-muted)}
.xp-svg .xp-s{font-size:12px}
.xp-svg .xp-l{font-size:16px;font-weight:600}
.xp-svg .xp-b{font-weight:600}
.xp-svg .xp-mono{font-family:"JetBrains Mono",ui-monospace,monospace}
.xp-svg .xp-bgrect{fill:var(--xp-bg)}
.xp-svg .xp-gridline{stroke:var(--xp-grid);stroke-width:1}
.xp-svg .xp-box{fill:var(--xp-surface);stroke:var(--xp-line);stroke-width:1.25}
.xp-svg .xp-box.is-active{fill:var(--xp-brand-soft);stroke:var(--xp-brand);stroke-width:1.75}
.xp-svg .xp-box.is-ok{fill:var(--xp-ok-soft);stroke:var(--xp-ok);stroke-width:1.75}
.xp-svg .xp-box.is-err{fill:var(--xp-err-soft);stroke:var(--xp-err);stroke-width:1.75}
.xp-svg .xp-box.is-warn{fill:var(--xp-warn-soft);stroke:var(--xp-warn);stroke-width:1.75}
.xp-svg .xp-fill{fill:var(--xp-line)}
.xp-svg .xp-fill.is-active{fill:var(--xp-brand)}
.xp-svg .xp-fill.is-ok{fill:var(--xp-ok)}
.xp-svg .xp-fill.is-err{fill:var(--xp-err)}
.xp-svg .xp-fill.is-warn{fill:var(--xp-warn)}
.xp-svg text.is-active{fill:var(--xp-brand)}
.xp-svg text.is-ok{fill:var(--xp-ok)}
.xp-svg text.is-err{fill:var(--xp-err)}
.xp-svg text.is-warn{fill:var(--xp-warn)}
.xp-svg .xp-wire{fill:none;stroke:var(--xp-line);stroke-width:1.5}
.xp-svg .xp-wire.is-active{stroke:var(--xp-brand);stroke-width:2;stroke-dasharray:5 6;animation:xp-flow .9s linear infinite}
.xp-svg .xp-wire.is-ok{stroke:var(--xp-ok);stroke-width:2;stroke-dasharray:5 6;animation:xp-flow .9s linear infinite}
.xp-svg .xp-wire.is-err{stroke:var(--xp-err);stroke-width:2}
.xp-svg .xp-wire.is-warn{stroke:var(--xp-warn);stroke-width:2;stroke-dasharray:5 6;animation:xp-flow .9s linear infinite}
.xp-svg .xp-arrow{fill:var(--xp-line)}
.xp-svg .xp-arrow.is-active{fill:var(--xp-brand)}
.xp-svg .xp-arrow.is-ok{fill:var(--xp-ok)}
.xp-svg .xp-arrow.is-err{fill:var(--xp-err)}
.xp-svg .xp-arrow.is-warn{fill:var(--xp-warn)}
.xp-svg .xp-anim{transition:transform .6s cubic-bezier(.2,.75,.2,1),opacity .45s ease,fill .45s ease,stroke .45s ease,width .6s cubic-bezier(.2,.75,.2,1),stroke-dashoffset .8s ease}
.xp-svg .is-dim{opacity:.32}
.xp-svg .is-hidden{opacity:0}
.xp-svg .xp-pulse.is-active{animation:xp-pulse 1.4s ease-in-out infinite}
.xp-svg .xp-shadow{filter:drop-shadow(0 1px 2px var(--xp-shadow))}
@keyframes xp-flow{to{stroke-dashoffset:-22}}
@keyframes xp-pulse{50%{opacity:.45}}
[data-xp-instant] .xp-anim,[data-xp-instant] .xp-html-anim{transition:none!important}
.xp-html-anim{transition:opacity .35s ease,transform .35s ease,background-color .35s ease,border-color .35s ease}
@media (prefers-reduced-motion:reduce){
  .xp-svg .xp-anim,.xp-html-anim{transition:none!important}
  .xp-svg .xp-wire,.xp-svg .xp-pulse{animation:none!important}
  [data-xp-progress]{transition:none!important}
}
`

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return
  const s = document.createElement("style")
  s.id = STYLE_ID
  s.textContent = CSS
  document.head.appendChild(s)
}

// Tiny helpers modules use against their own SVG. Keys are data-k attributes; one key
// may name several elements (all are updated).
export function helpers(root) {
  const all = (k) => root.querySelectorAll(`[data-k="${k}"]`)
  return {
    root,
    q: (k) => root.querySelector(`[data-k="${k}"]`),
    all,
    // cls("box", { "is-active": true, "is-dim": false })
    cls(k, map) {
      for (const el of all(k)) for (const [c, on] of Object.entries(map)) el.classList.toggle(c, !!on)
    },
    // state("box", "ok") sets exactly one of the state classes (or none with "").
    state(k, s) {
      for (const el of all(k)) {
        for (const c of ["is-active", "is-ok", "is-err", "is-warn"]) el.classList.toggle(c, c === `is-${s}`)
      }
    },
    show(k, on) {
      for (const el of all(k)) el.classList.toggle("is-hidden", !on)
    },
    dim(k, on) {
      for (const el of all(k)) el.classList.toggle("is-dim", !!on)
    },
    text(k, t) {
      for (const el of all(k)) if (el.textContent !== t) el.textContent = t
    },
    move(k, x, y) {
      for (const el of all(k)) el.style.transform = `translate(${x}px, ${y}px)`
    },
    attr(k, name, v) {
      for (const el of all(k)) el.setAttribute(name, v)
    },
  }
}

// svg(width, height, body) wraps diagram markup in a responsive SVG. The dotted
// background is painted by the stage behind it, so it fills any width.
export function svg(w, h, body, label) {
  return `<svg class="xp-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}" preserveAspectRatio="xMidYMid meet">
${body}</svg>`
}

// Escape text for template strings that become SVG/HTML.
export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const registry = new Map()

export function register(key, def) {
  registry.set(key, def)
}

function mountFigure(fig, def) {
  const stage = fig.querySelector("[data-xp-stage]")
  const items = [...fig.querySelectorAll("[data-xp-steps] li")]
  const steps = items.map((li) => ({ title: li.dataset.title || "", text: li.dataset.text || li.textContent.trim() }))
  const n = steps.length
  const api = def.build(stage)
  if (def.steps !== undefined && def.steps !== n) {
    // The captions come from front matter and the pictures from the module; a mismatch
    // means one was edited without the other. Say so instead of silently drifting.
    console.warn(`explainer ${fig.dataset.explainer}: module draws ${def.steps} steps but the page has ${n} captions`)
  }
  const els = {
    count: fig.querySelector("[data-xp-count]"),
    title: fig.querySelector("[data-xp-title]"),
    text: fig.querySelector("[data-xp-text]"),
    prev: fig.querySelector("[data-xp-prev]"),
    next: fig.querySelector("[data-xp-next]"),
    play: fig.querySelector("[data-xp-play]"),
    reset: fig.querySelector("[data-xp-reset]"),
    dots: fig.querySelector("[data-xp-dots]"),
    progress: fig.querySelector("[data-xp-progress]"),
  }
  // Step dots, built here so their number always equals the caption count.
  const dots = steps.map((s, i) => {
    const b = document.createElement("button")
    b.type = "button"
    b.className = "group h-6 min-w-4 px-0.5 inline-flex items-center justify-center"
    b.setAttribute("aria-label", `Go to step ${i + 1}: ${s.title}`)
    b.innerHTML = `<span class="block h-1.5 rounded-full transition-all duration-300 bg-slate-300 dark:bg-slate-700 group-hover:bg-slate-400 dark:group-hover:bg-slate-500"></span>`
    b.addEventListener("click", () => {
      stop()
      go(i)
    })
    els.dots?.appendChild(b)
    return b
  })
  for (const [i, li] of items.entries()) {
    li.addEventListener("click", () => {
      stop()
      go(i)
    })
  }

  let cur = -1
  let timer = 0
  let playing = false

  function render(i, animate) {
    const instant = !animate || reducedMotion()
    if (instant) fig.setAttribute("data-xp-instant", "")
    def.apply(api, i, { animate: !instant })
    if (instant) {
      // Let the browser paint the new state before transitions come back on.
      requestAnimationFrame(() => requestAnimationFrame(() => fig.removeAttribute("data-xp-instant")))
    }
    const s = steps[i]
    els.count.textContent = `Step ${i + 1} of ${n}`
    els.title.textContent = s.title
    els.text.textContent = s.text
    els.prev.disabled = i === 0
    els.next.disabled = i === n - 1
    for (const [j, d] of dots.entries()) {
      const bar = d.firstElementChild
      const on = j === i
      d.setAttribute("aria-current", on ? "step" : "false")
      bar.className = `block h-1.5 rounded-full transition-all duration-300 ${on ? "w-5 bg-brand-600 dark:bg-brand-400" : j < i ? "w-1.5 bg-brand-600/40 dark:bg-brand-400/40" : "w-1.5 bg-slate-300 dark:bg-slate-700 group-hover:bg-slate-400 dark:group-hover:bg-slate-500"}`
    }
    for (const [j, li] of items.entries()) li.toggleAttribute("data-current", j === i)
    fig.dataset.step = String(i + 1)
  }

  function go(i, animate = true) {
    const t = Math.max(0, Math.min(n - 1, i))
    if (t === cur) return
    const jump = Math.abs(t - cur) > 1 && cur !== -1
    cur = t
    render(t, animate && !jump)
  }

  function setPlayLabel() {
    els.play.setAttribute("aria-pressed", String(playing))
    els.play.setAttribute("aria-label", playing ? "Pause" : "Play")
    els.play.querySelector("[data-xp-icon-play]").classList.toggle("hidden", playing)
    els.play.querySelector("[data-xp-icon-pause]").classList.toggle("hidden", !playing)
    els.play.querySelector("[data-xp-play-label]").textContent = playing ? "Pause" : "Play"
  }

  function armProgress() {
    if (!els.progress) return
    els.progress.style.transition = "none"
    els.progress.style.width = "0%"
    if (!playing) return
    void els.progress.offsetWidth // restart the fill from zero
    els.progress.style.transition = `width ${DWELL_MS}ms linear`
    els.progress.style.width = "100%"
  }

  function tick() {
    if (cur >= n - 1) return stop()
    go(cur + 1)
    if (cur >= n - 1) return stop()
    armProgress()
    timer = window.setTimeout(tick, DWELL_MS)
  }

  function play() {
    if (playing) return
    if (cur >= n - 1) go(0) // Play at the end starts over
    playing = true
    setPlayLabel()
    armProgress()
    timer = window.setTimeout(tick, DWELL_MS)
  }

  function stop() {
    playing = false
    window.clearTimeout(timer)
    setPlayLabel()
    armProgress()
  }

  els.prev.addEventListener("click", () => {
    stop()
    go(cur - 1)
  })
  els.next.addEventListener("click", () => {
    stop()
    go(cur + 1)
  })
  els.reset.addEventListener("click", () => {
    stop()
    go(0, false)
  })
  els.play.addEventListener("click", () => (playing ? stop() : play()))

  fig.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return
    const onButton = e.target instanceof HTMLButtonElement
    if (e.key === "ArrowRight") {
      stop()
      go(cur + 1)
    } else if (e.key === "ArrowLeft") {
      stop()
      go(cur - 1)
    } else if (e.key === "Home") {
      stop()
      go(0)
    } else if (e.key === "End") {
      stop()
      go(n - 1)
    } else if ((e.key === " " || e.key === "Spacebar") && !onButton) {
      playing ? stop() : play()
    } else return
    e.preventDefault()
  })

  go(0, false)
  setPlayLabel()

  // Auto-play once, the first time the diagram scrolls into view, unless the reader
  // prefers reduced motion. Any control press stops it for good.
  if (!reducedMotion() && "IntersectionObserver" in window) {
    let touched = false
    fig.addEventListener("pointerdown", () => (touched = true), { once: true })
    fig.addEventListener("keydown", () => (touched = true), { once: true })
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((en) => en.isIntersecting && en.intersectionRatio >= 0.6)) {
          io.disconnect()
          if (!touched && cur === 0) play()
        }
      },
      { threshold: [0.6] },
    )
    io.observe(stage)
  }
}

function mountPreview(el, def) {
  const api = def.build(el, { preview: true })
  el.setAttribute("data-xp-instant", "")
  def.apply(api, def.preview ?? 0, { animate: false, preview: true })
}

export function start() {
  const figs = document.querySelectorAll("[data-explainer]")
  const previews = document.querySelectorAll("[data-explainer-preview]")
  if (!figs.length && !previews.length) return
  injectStyle()
  for (const fig of figs) {
    const def = registry.get(fig.dataset.explainer)
    if (!def) {
      console.warn(`explainer: no module registered for "${fig.dataset.explainer}"`)
      continue
    }
    mountFigure(fig, def)
  }
  for (const el of previews) {
    const def = registry.get(el.dataset.explainerPreview)
    if (def) mountPreview(el, def)
  }
}
