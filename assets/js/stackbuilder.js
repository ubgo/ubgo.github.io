// Home: "Build almost any app" stack builder. Picking an app shape lights up the
// modules it uses (data-mods on the button) and draws a wire from each lit tile
// to the "Your app" box. Wires are recomputed on resize because tile positions
// depend on how the bands wrap. Without JS the first shape is shown, unwired.
const root = document.querySelector("[data-sb]")
if (root) {
  const NS = "http://www.w3.org/2000/svg"
  const stage = root.querySelector("[data-sb-stage]")
  const svg = root.querySelector("[data-sb-wires]")
  const app = root.querySelector("[data-sb-app]")
  const title = root.querySelector("[data-sb-title]")
  const text = root.querySelector("[data-sb-text]")
  const picks = [...root.querySelectorAll("[data-stack]")]
  const tiles = [...root.querySelectorAll("[data-mod]")]
  let current = picks.find((p) => p.getAttribute("aria-pressed") === "true") || picks[0]

  const wire = () => {
    svg.replaceChildren()
    const s = stage.getBoundingClientRect()
    svg.setAttribute("viewBox", `0 0 ${s.width} ${s.height}`)
    const a = app.getBoundingClientRect()
    const ax = a.left + a.width / 2 - s.left
    const ay = a.bottom - s.top
    for (const t of tiles) {
      if (!t.classList.contains("is-on")) continue
      const r = t.getBoundingClientRect()
      const x = r.left + r.width / 2 - s.left
      const y = r.top - s.top
      const d = `M${x} ${y} C${x} ${y - (y - ay) * 0.55}, ${ax} ${ay + (y - ay) * 0.45}, ${ax} ${ay}`
      for (const cls of ["sb-wire", "sb-pulse"]) {
        const p = document.createElementNS(NS, "path")
        p.setAttribute("d", d)
        p.setAttribute("class", cls + (t.classList.contains("is-up") ? " is-up" : ""))
        svg.append(p)
      }
    }
  }

  const select = (btn) => {
    current = btn
    const on = new Set(btn.dataset.mods.split(" "))
    for (const p of picks) p.setAttribute("aria-pressed", p === btn ? "true" : "false")
    for (const t of tiles) t.classList.toggle("is-on", on.has(t.dataset.mod))
    title.textContent = btn.querySelector("span").textContent
    text.textContent = btn.dataset.text
    root.classList.add("is-picked")
    // Phones scroll the shape list sideways; keep the picked one in view without
    // moving the page vertically.
    const row = btn.parentElement
    if (row.scrollWidth > row.clientWidth) row.scrollTo({ left: btn.offsetLeft - row.clientWidth / 2 + btn.offsetWidth / 2, behavior: "smooth" })
    wire()
  }

  for (const p of picks) {
    p.addEventListener("click", () => { stopTour(); select(p) })
    p.addEventListener("mouseenter", () => { if (matchMedia("(hover: hover)").matches) { stopTour(); select(p) } })
  }
  // Arrow keys move between shapes, like a tab list.
  root.addEventListener("keydown", (e) => {
    const i = picks.indexOf(document.activeElement)
    if (i < 0 || !["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(e.key)) return
    e.preventDefault()
    const next = picks[(i + (e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : picks.length - 1)) % picks.length]
    next.focus()
    stopTour()
    select(next)
  })

  // A short tour through the shapes while the builder is on screen, until the
  // visitor picks one. Off under reduced motion.
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches
  let tour = 0
  const stopTour = () => { clearInterval(tour); tour = -1 }
  if (!reduce && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => {
      if (tour === -1) return io.disconnect()
      const seen = es.some((e) => e.isIntersecting)
      clearInterval(tour)
      tour = seen ? setInterval(() => select(picks[(picks.indexOf(current) + 1) % picks.length]), 3200) : 0
    }, { threshold: 0.4 })
    io.observe(stage)
  }

  new ResizeObserver(wire).observe(stage)
  select(current)
}
