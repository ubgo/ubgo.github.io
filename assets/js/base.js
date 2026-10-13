// Site behavior: theme toggle, copy buttons, and the client-side library filter.
// No framework; every feature is skipped when its markup is not on the page.

function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key)
    localStorage.setItem(key, value)
  } catch (e) {
    return null
  }
  return null
}

// Theme toggle: flips the .dark class on <html> and remembers the choice.
for (const btn of document.querySelectorAll("[data-theme-toggle]")) {
  btn.addEventListener("click", () => {
    const dark = document.documentElement.classList.toggle("dark")
    store("theme", dark ? "dark" : "light")
  })
}

// Early-alpha notice: dismissal is remembered. The head script already hides the bar before
// first paint when it was dismissed; this only wires the button. Without storage the bar shows every time.
for (const btn of document.querySelectorAll("[data-alpha-dismiss]")) {
  btn.addEventListener("click", () => {
    document.documentElement.classList.add("alpha-off")
    store("alpha-notice", "dismissed")
  })
}

// Copy buttons next to install lines.
for (const btn of document.querySelectorAll("[data-copy]")) {
  btn.addEventListener("click", async () => {
    const src = btn.parentElement.querySelector("[data-copy-src]")
    if (!src) return
    try {
      await navigator.clipboard.writeText(src.textContent.trim())
      btn.textContent = "Copied"
    } catch (e) {
      btn.textContent = "Press Ctrl+C"
      const r = document.createRange()
      r.selectNodeContents(src)
      const s = window.getSelection()
      s.removeAllRanges()
      s.addRange(r)
    }
    setTimeout(() => { btn.textContent = "Copy" }, 1500)
  })
}

// Library index filter: search text + one area, kept in the URL (?q=&area=).
const filters = document.querySelector("[data-lib-filters]")
if (filters) {
  const input = document.getElementById("lib-q")
  const chips = [...filters.querySelectorAll("[data-area]")]
  const rows = [...document.querySelectorAll("tr[data-lib]")]
  const count = filters.querySelector("[data-lib-count]")
  const empty = document.querySelector("[data-lib-empty]")
  const params = new URLSearchParams(location.search)
  const validAreas = new Set(chips.map((c) => c.dataset.area))
  let area = validAreas.has(params.get("area") || "") ? params.get("area") || "" : ""
  input.value = params.get("q") || ""

  function apply() {
    const words = input.value.toLowerCase().split(/\s+/).filter(Boolean)
    let shown = 0
    for (const row of rows) {
      const ok = (!area || row.dataset.area === area) && words.every((w) => row.dataset.text.includes(w))
      row.hidden = !ok
      if (ok) shown++
    }
    for (const c of chips) c.setAttribute("aria-pressed", String(c.dataset.area === area))
    count.textContent = `${shown} of ${rows.length}`
    empty.classList.toggle("hidden", shown > 0)
    const p = new URLSearchParams()
    if (input.value) p.set("q", input.value)
    if (area) p.set("area", area)
    const qs = p.toString()
    history.replaceState(null, "", qs ? `?${qs}` : location.pathname)
  }

  for (const c of chips) c.addEventListener("click", () => { area = c.dataset.area; apply() })
  input.addEventListener("input", apply)
  document.querySelector("[data-lib-reset]")?.addEventListener("click", () => { area = ""; input.value = ""; apply(); input.focus() })
  document.addEventListener("keydown", (e) => {
    const typing = e.target instanceof HTMLElement && (e.target.matches("input, textarea") || e.target.isContentEditable)
    if (e.key === "/" && !typing) { e.preventDefault(); input.focus(); input.select() }
    else if (e.key === "Escape" && e.target === input) { input.value = ""; apply() }
  })
  apply()
}

// Phone menu (<details data-menu>): close on outside click or Esc.
const menu = document.querySelector("[data-menu]")
if (menu) {
  document.addEventListener("click", (e) => { if (menu.open && !menu.contains(e.target)) menu.open = false })
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && menu.open) { menu.open = false; menu.querySelector("summary").focus() } })
}
