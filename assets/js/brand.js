// Brand page: click a colour swatch to copy its hex value.
for (const s of document.querySelectorAll("[data-swatch]")) {
  s.addEventListener("click", async () => {
    const label = s.querySelector("[data-swatch-label]")
    try {
      await navigator.clipboard.writeText(s.dataset.swatch)
      label.textContent = "Copied"
    } catch (e) {
      label.textContent = "Copy failed"
    }
    s.classList.add("copied")
    setTimeout(() => { label.textContent = s.dataset.swatch; s.classList.remove("copied") }, 1200)
  })
}
