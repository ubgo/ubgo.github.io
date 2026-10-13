// Code example tabs on library pages: click or arrow keys switch panels; Copy copies
// the visible panel's code.
for (const box of document.querySelectorAll("[data-codetabs]")) {
  const tabs = [...box.querySelectorAll('[role="tab"]')]
  const panels = [...box.querySelectorAll('[role="tabpanel"]')]
  const select = (i, focus) => {
    tabs.forEach((t, j) => {
      t.setAttribute("aria-selected", String(i === j))
      t.tabIndex = i === j ? 0 : -1
      panels[j].hidden = i !== j
    })
    if (focus) tabs[i].focus()
  }
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => select(i, false))
    t.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); select((i + 1) % tabs.length, true) }
      if (e.key === "ArrowLeft") { e.preventDefault(); select((i - 1 + tabs.length) % tabs.length, true) }
    })
  })
  const copy = box.querySelector("[data-copy-code]")
  copy?.addEventListener("click", async () => {
    const code = panels.find((p) => !p.hidden)?.querySelector("code")?.innerText ?? ""
    try {
      await navigator.clipboard.writeText(code.replace(/\n$/, ""))
      copy.textContent = "Copied"
    } catch (e) {
      copy.textContent = "Copy failed"
    }
    setTimeout(() => { copy.textContent = "Copy" }, 1500)
  })
}
