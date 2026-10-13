// Command palette: Ctrl+K / Cmd+K (or the header button) opens a searchable list of
// libraries, areas, explainers and pages from /index.json. Arrow keys move, Enter
// opens, Esc closes. The index is fetched once, on first open.
const INDEX_URL = document.documentElement.dataset.searchIndex || "/index.json"
const MAX_RESULTS = 12
let items = null
let dialog = null

function score(item, words) {
  // Every word must appear; matches in the title rank above matches in the text.
  const title = item.title.toLowerCase()
  const hay = `${title} ${item.text.toLowerCase()} ${(item.meta || "").toLowerCase()} ${item.type.toLowerCase()}`
  let s = 0
  for (const w of words) {
    if (!hay.includes(w)) return -1
    s += title === w ? 100 : title.startsWith(w) ? 50 : title.includes(w) ? 20 : 1
  }
  return s
}

function escapeHTML(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c])
}

function build() {
  dialog = document.createElement("dialog")
  dialog.className = "palette"
  dialog.setAttribute("aria-label", "Command palette")
  dialog.innerHTML = `
    <div class="palette-box">
      <div class="palette-input-row">
        <svg viewBox="0 0 24 24" class="size-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input type="text" role="combobox" aria-expanded="true" aria-controls="palette-list" aria-autocomplete="list" placeholder="Search libraries, areas, explainers…" autocomplete="off" spellcheck="false">
        <kbd class="palette-kbd">Esc</kbd>
      </div>
      <ul id="palette-list" role="listbox" class="palette-list"></ul>
      <div class="palette-foot"><span><kbd class="palette-kbd">↑</kbd><kbd class="palette-kbd">↓</kbd> move</span><span><kbd class="palette-kbd">Enter</kbd> open</span><span><kbd class="palette-kbd">Esc</kbd> close</span></div>
    </div>`
  document.body.appendChild(dialog)
  const input = dialog.querySelector("input")
  const list = dialog.querySelector("ul")
  let results = []
  let active = 0

  const render = () => {
    const words = input.value.toLowerCase().split(/\s+/).filter(Boolean)
    results = (items || [])
      .map((it, i) => ({ it, s: words.length ? score(it, words) : 1000 - i }))
      .filter((r) => r.s >= 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, MAX_RESULTS)
      .map((r) => r.it)
    if (!words.length) results = (items || []).filter((it) => it.type === "Page" || it.type === "Explainer").slice(0, MAX_RESULTS)
    active = Math.min(active, Math.max(results.length - 1, 0))
    list.innerHTML = results.length
      ? results.map((r, i) => `<li role="option" id="pal-${i}" aria-selected="${i === active}" data-i="${i}"><span class="palette-type">${escapeHTML(r.type)}</span><span class="min-w-0 flex-1"><span class="palette-title">${escapeHTML(r.title)}</span><span class="palette-text">${escapeHTML(r.text || "")}</span></span>${r.meta ? `<span class="palette-meta">${escapeHTML(String(r.meta))}</span>` : ""}</li>`).join("")
      : `<li class="palette-empty">${items ? "No matches. Try a library name like cache or logger." : "Loading…"}</li>`
    input.setAttribute("aria-activedescendant", results.length ? `pal-${active}` : "")
    list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" })
  }
  const go = (i) => { const r = results[i]; if (r) location.href = r.url }

  input.addEventListener("input", () => { active = 0; render() })
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); active = (active + 1) % Math.max(results.length, 1); render() }
    else if (e.key === "ArrowUp") { e.preventDefault(); active = (active - 1 + results.length) % Math.max(results.length, 1); render() }
    else if (e.key === "Enter") { e.preventDefault(); go(active) }
  })
  list.addEventListener("mousemove", (e) => {
    const li = e.target.closest("[data-i]")
    if (li && +li.dataset.i !== active) { active = +li.dataset.i; render() }
  })
  list.addEventListener("click", (e) => { const li = e.target.closest("[data-i]"); if (li) go(+li.dataset.i) })
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close() })
  dialog.render = render
}

async function open() {
  if (!dialog) build()
  const input = dialog.querySelector("input")
  input.value = ""
  dialog.showModal()
  input.focus()
  dialog.render()
  if (!items) {
    try {
      items = (await (await fetch(INDEX_URL)).json()).items
    } catch (e) {
      items = []
    }
    dialog.render()
  }
}

document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault()
    if (dialog?.open) dialog.close()
    else open()
  }
})
for (const b of document.querySelectorAll("[data-palette-open]")) b.addEventListener("click", open)
// Show the right shortcut for the platform on the header button.
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
for (const k of document.querySelectorAll("[data-palette-key]")) k.textContent = isMac ? "⌘K" : "Ctrl K"
