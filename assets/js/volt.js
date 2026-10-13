// volt page: the release terminal plays its lines one by one when it scrolls into
// view, and again on Replay. Under reduced motion every line shows at once.
const term = document.querySelector("[data-volt-term]")
if (term) {
  const body = term.querySelector("[data-term-body]")
  const lines = body.innerHTML.split("\n")
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches
  let timer = null
  const play = () => {
    clearTimeout(timer)
    if (reduce) { body.innerHTML = lines.join("\n"); return }
    let i = 0
    const step = () => {
      body.innerHTML = lines.slice(0, i + 1).join("\n") + (i < lines.length - 1 ? '\n<span class="term-caret"></span>' : "")
      i++
      if (i < lines.length) timer = setTimeout(step, lines[i - 1].includes("$") ? 650 : 380)
    }
    step()
  }
  term.querySelector("[data-term-replay]")?.addEventListener("click", play)
  if (!reduce && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); play() } }, { threshold: 0.5 })
    io.observe(term)
  }
}
