// "Which package do I need?" — walks the decision tree from data/picker.yaml (emitted
// as JSON by layouts/picker.html). State lives in the URL hash (#need/cache-where/...)
// so an answer path can be shared and Back works.
const root = document.querySelector("[data-picker]")
const dataEl = document.getElementById("picker-data")
if (root && dataEl) {
  const { tree, libs, base } = JSON.parse(dataEl.textContent)
  const stage = root.querySelector("[data-picker-stage]")
  const trail = root.querySelector("[data-picker-trail]")
  const back = root.querySelector("[data-picker-back]")
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c])

  const readPath = () => {
    const ids = location.hash.replace(/^#/, "").split("/").filter((id) => tree.nodes[id])
    return ids.length && ids[0] === tree.start ? ids : [tree.start]
  }
  let path = readPath()

  const optionLabel = (fromId, toId) => tree.nodes[fromId]?.options?.find((o) => o.next === toId)?.label ?? ""

  function render(animate = true) {
    const id = path[path.length - 1]
    const node = tree.nodes[id]
    back.disabled = path.length < 2
    trail.innerHTML = path.slice(1).map((nid, i) => `<li class="inline-flex items-center gap-1"><button type="button" data-goto="${i + 1}" class="h-6 px-2 rounded-full bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-100 hover:bg-brand-100 dark:hover:bg-brand-500/25">${esc(optionLabel(path[i], nid))}</button>${i < path.length - 2 ? '<span class="text-slate-400" aria-hidden="true">›</span>' : ""}</li>`).join("")
    if (node.q) {
      stage.innerHTML = `<p class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Question ${path.length}</p>
        <h2 class="mt-1 font-display font-semibold text-[20px] sm:text-[22px] text-slate-900 dark:text-white">${esc(node.q)}</h2>
        <div class="mt-4 grid gap-2 sm:grid-cols-2">${node.options.map((o, i) => `
          <button type="button" data-next="${esc(o.next)}" class="picker-opt group text-left rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-3 hover:border-brand-500 hover:shadow-sm focus-visible:border-brand-500 transition">
            <span class="flex items-start gap-3"><kbd class="palette-kbd mt-0.5">${i + 1}</kbd><span><span class="block font-medium text-[14px] text-slate-900 dark:text-white group-hover:text-brand-700 dark:group-hover:text-brand-400">${esc(o.label)}</span>${o.hint ? `<span class="block mt-0.5 text-[12.5px] text-slate-500 dark:text-slate-400">${esc(o.hint)}</span>` : ""}</span></span>
          </button>`).join("")}</div>`
    } else {
      const r = node.result
      stage.innerHTML = `<p class="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Recommended</p>
        <p class="mt-1 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">${esc(r.why)}</p>
        <div class="mt-4 grid gap-2">${r.libs.map((name) => {
          const l = libs[name] || {}
          const install = r.pkg && name === "lock" ? `go get github.com/ubgo/lock/${r.pkg}` : l.install
          return `<a href="${base}libraries/${esc(name)}/" class="group block rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 hover:border-brand-500 transition">
            <span class="flex items-center justify-between gap-2"><span class="font-mono font-semibold text-[15px] text-slate-900 dark:text-white group-hover:text-brand-700 dark:group-hover:text-brand-400">${esc(name)}${r.pkg && name === "lock" ? `<span class="text-slate-400">/${esc(r.pkg)}</span>` : ""}</span><span class="text-[12px] text-slate-400 group-hover:text-brand-600">Open →</span></span>
            <span class="block mt-1 text-[13px] text-slate-600 dark:text-slate-400">${esc(l.summary)}</span>
            ${install ? `<code class="mt-2 block truncate rounded-md bg-slate-50 dark:bg-slate-800/70 px-2 py-1 font-mono text-[12px] text-slate-700 dark:text-slate-300">$ ${esc(install)}</code>` : ""}
          </a>`
        }).join("")}</div>
        <p class="mt-3 text-[12px] text-slate-500">Based on: ${esc(r.source)}.</p>`
    }
    if (animate && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      stage.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 180, easing: "ease-out" })
    }
  }

  const go = (newPath) => {
    path = newPath
    history.replaceState(null, "", path.length > 1 ? `#${path.join("/")}` : location.pathname)
    render()
    stage.querySelector("button, a")?.focus({ preventScroll: true })
  }
  stage.addEventListener("click", (e) => { const b = e.target.closest("[data-next]"); if (b) go([...path, b.dataset.next]) })
  trail.addEventListener("click", (e) => { const b = e.target.closest("[data-goto]"); if (b) go(path.slice(0, +b.dataset.goto)) })
  back.addEventListener("click", () => go(path.slice(0, -1)))
  root.querySelector("[data-picker-restart]").addEventListener("click", () => go([tree.start]))
  document.addEventListener("keydown", (e) => {
    if (e.target.matches?.("input, textarea") || e.metaKey || e.ctrlKey || e.altKey || document.querySelector("dialog[open]")) return
    const n = parseInt(e.key, 10)
    const opts = stage.querySelectorAll("[data-next]")
    if (n >= 1 && n <= opts.length) { e.preventDefault(); opts[n - 1].click() }
    else if (e.key === "Backspace" && path.length > 1) { e.preventDefault(); go(path.slice(0, -1)) }
  })
  window.addEventListener("hashchange", () => { path = readPath(); render() })
  render(false)
}
